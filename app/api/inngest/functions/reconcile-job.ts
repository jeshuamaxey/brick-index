// Inngest function for reconcile jobs
// Handles long-running reconcile jobs by breaking work into batches

import { inngest } from '@/lib/inngest/client';
import { supabaseServer } from '@/lib/supabase/server';
import { BaseJobService } from '@/lib/jobs/base-job-service';
import {
  ReconcileService,
} from '@/lib/analyze/reconcile-service';
import { createJobLogger } from '@/lib/logging';
import type { JobType } from '@/lib/types';
import type { Json } from '@/lib/supabase/supabase.types';

const BATCH_SIZE = 100; // Process 100 listings per step to avoid timeout

interface ReconcileJobEvent {
  name: 'job/reconcile.triggered';
  data: {
    listingIds?: string[];
    limit?: number;
    reconciliationVersion?: string;
    cleanupMode?: 'delete' | 'supersede' | 'keep';
    rerun?: boolean;
  };
}

import { INNGEST_FUNCTION_IDS } from './registry';

/**
 * Check if an error is critical and should cause the entire job to fail
 * Critical errors include database schema issues, missing tables/columns, etc.
 */
function isCriticalError(errorMessage: string): boolean {
  const criticalErrorPatterns = [
    /Could not find.*column.*in the schema cache/i,
    /relation.*does not exist/i,
    /column.*does not exist/i,
    /table.*does not exist/i,
    /schema.*does not exist/i,
    /permission denied/i,
    /syntax error/i,
    /invalid.*schema/i,
    /database.*error/i,
    /connection.*refused/i,
    /timeout/i,
  ];
  
  return criticalErrorPatterns.some(pattern => pattern.test(errorMessage));
}

export const reconcileJob = inngest.createFunction(
  { id: INNGEST_FUNCTION_IDS.RECONCILE_JOB },
  { event: 'job/reconcile.triggered' },
  async ({ event, step }) => {
    // Create logger for this job (will update with actual jobId after creation)
    // Note: Logger creation must be outside steps, but logging should be inside steps
    // to avoid duplicate logs during Inngest's step replay
    let log = createJobLogger('pending', 'reconcile');
    let jobId: string | undefined;
    
    try {
    const {
      listingIds,
      limit,
      reconciliationVersion,
      cleanupMode = 'supersede',
      rerun = false,
      datasetId,
    } = event.data;

    // Use provided version or default to current version
    const versionToUse =
      reconciliationVersion || ReconcileService.RECONCILIATION_VERSION;

    // Step 1: Create job record
    const job = await step.run('create-job', async () => {
      log.info({ eventData: event.data }, 'Reconcile job triggered');
      
      const jobService = new BaseJobService(supabaseServer);
      const metadata: Record<string, unknown> = {
        listingIds: listingIds || null,
        limit: limit || null,
        reconciliationVersion: versionToUse,
        cleanupMode: cleanupMode,
        rerun: rerun,
      };
      
      const createdJob = await jobService.createJob(
        'reconcile' as JobType,
        'all', // Marketplace doesn't really apply to reconcile
        metadata,
        datasetId
      );
      return createdJob;
    });

    const jobId = job.id;
    // Update logger with actual job ID
    log = log.child({ jobId });

    // Step 2: Initialize reconcile service
    const reconcileService = new ReconcileService(supabaseServer);

    // Step 3: Get listings to reconcile
    let listingIdsToReconcile: string[];

    // If dataset_id is provided and listingIds is not provided, get listing IDs from dataset
    let resolvedListingIds = listingIds;
    if (datasetId && (!listingIds || listingIds.length === 0)) {
      const datasetListingIds = await step.run('get-dataset-listing-ids', async () => {
        const { data: datasetListings, error: datasetError } = await supabaseServer
          .schema('public')
          .from('dataset_listings')
          .select('listing_id')
          .eq('dataset_id', datasetId);

        if (datasetError) {
          throw new Error(`Failed to get dataset listings: ${datasetError.message}`);
        }

        return datasetListings ? datasetListings.map(dl => dl.listing_id) : [];
      });
      
      if (datasetListingIds.length > 0) {
        resolvedListingIds = datasetListingIds;
      } else {
        // No listings in dataset, return empty
        resolvedListingIds = [];
      }
    }

    if (resolvedListingIds && resolvedListingIds.length > 0) {
      // Use provided listing IDs (or dataset listing IDs)
      listingIdsToReconcile = resolvedListingIds;

      await step.run('update-progress-found', async () => {
        const jobService = new BaseJobService(supabaseServer);
        await jobService.updateJobProgress(
          jobId,
          `Found ${resolvedListingIds.length} listings to reconcile...`,
          { listings_found: resolvedListingIds.length }
        );
      });
    } else {
      // Find listings that have not yet been reconciled
      await step.run('update-progress-finding', async () => {
        const jobService = new BaseJobService(supabaseServer);
        await jobService.updateJobProgress(
          jobId,
          'Finding listings to reconcile...'
        );
      });

      listingIdsToReconcile = await step.run('find-listings', async () => {
        // Query listings table directly for listings to reconcile
        // Listings that either:
        // 1. Have NOT been reconciled (reconciled_at IS NULL), OR
        // 2. Have been reconciled with an older version (reconciliation_version != current version)
        // 3. If rerun=true: Also include listings reconciled with the current version (reconciliation_version == current version)
        // We need to fetch all active listings and filter in code since Supabase doesn't support complex OR with NULL easily
        let query = supabaseServer
          .schema('pipeline')
          .from('listings')
          .select('id, reconciliation_version, reconciled_at')
          .eq('status', 'active');

        // Filter by dataset if provided
        if (datasetId) {
          const { data: datasetListings, error: datasetError } = await supabaseServer
            .schema('public')
            .from('dataset_listings')
            .select('listing_id')
            .eq('dataset_id', datasetId);

          if (datasetError) {
            throw new Error(`Failed to get dataset listings: ${datasetError.message}`);
          }

          if (datasetListings && datasetListings.length > 0) {
            const datasetListingIds = datasetListings.map(dl => dl.listing_id);
            query = query.in('id', datasetListingIds);
          } else {
            // No listings in dataset, return empty
            return [];
          }
        }

        // Apply limit if provided (we'll filter after fetching)
        if (limit) {
          // Fetch more than limit to account for filtering, but cap at reasonable number
          query = query.limit(limit * 2);
        }

        const { data: listings, error: listingsError } = await query;

        if (listingsError) {
          log.error({ err: listingsError }, 'Error fetching listings');
          const errorMessage = `Failed to fetch listings: ${listingsError.message}`;
          // Check if this is a critical error
          if (isCriticalError(listingsError.message)) {
            log.error({ err: listingsError }, 'CRITICAL ERROR detected while fetching listings - will fail job');
            throw new Error(errorMessage);
          }
          throw new Error(errorMessage);
        }

        if (!listings || listings.length === 0) {
          return [];
        }

        // Filter listings that need reconciliation:
        // 1. Not reconciled (reconciled_at IS NULL), OR
        // 2. Reconciled with different version, OR
        // 3. If rerun=true: Also include listings reconciled with the current version
        const listingsToReconcile = listings.filter(
          (listing) => {
            const notReconciled = listing.reconciled_at === null;
            const differentVersion = listing.reconciliation_version !== versionToUse;
            const sameVersionRerun = rerun && listing.reconciliation_version === versionToUse;
            
            return notReconciled || differentVersion || sameVersionRerun;
          }
        );

        let listingIds = listingsToReconcile.map((l) => l.id);

        // Apply limit if provided
        if (limit) {
          listingIds = listingIds.slice(0, limit);
        }

        return listingIds;
      });

      if (listingIdsToReconcile.length === 0) {
        await step.run('complete-job-no-work', async () => {
          const jobService = new BaseJobService(supabaseServer);
          await jobService.completeJob(
            jobId,
            {
              listings_found: 0,
              extracted: 0,
              validated: 0,
              joins_created: 0,
            },
            'No listings found to reconcile'
          );
        });
        return {
          jobId,
          total: 0,
          succeeded: 0,
          failed: 0,
          errors: [],
        };
      }

      await step.run('update-progress-found', async () => {
        const jobService = new BaseJobService(supabaseServer);
        await jobService.updateJobProgress(
          jobId,
          `Found ${listingIdsToReconcile.length} listings to reconcile...`,
          { listings_found: listingIdsToReconcile.length }
        );
      });
    }

    // Step 4: Process listings in batches
    const result = {
      succeeded: 0,
      failed: 0,
      errors: [] as Array<{ listingId: string; error: string }>,
      totalExtracted: 0,
      totalValidated: 0,
      totalJoinsCreated: 0,
      // Distribution of listings by number of IDs found
      listingsWithZeroIds: 0,
      listingsWithOneId: 0,
      listingsWithTwoIds: 0,
      listingsWithThreeIds: 0,
      listingsWithFourIds: 0,
      listingsWithFiveOrMoreIds: 0,
      // Track all extracted IDs for JSON export and metadata
      allExtractedIds: new Set<string>(),
      allValidatedIds: Array<{ extractedId: string; listingId: string }>(),
      allNotValidatedIds: Array<{ extractedId: string; listingId: string }>(),
      // Track all processed listing IDs (including ones with zero extracted IDs)
      processedListingIds: Array<string>(),
    };

    const batches = Math.ceil(listingIdsToReconcile.length / BATCH_SIZE);

    for (let i = 0; i < batches; i++) {
      const start = i * BATCH_SIZE;
      const end = Math.min(start + BATCH_SIZE, listingIdsToReconcile.length);
      const batch = listingIdsToReconcile.slice(start, end);

      // Process batch
      const batchResult = await step.run(`process-batch-${i}`, async () => {
        const batchStats = {
          succeeded: 0,
          failed: 0,
          errors: [] as Array<{ listingId: string; error: string }>,
          extracted: 0,
          validated: 0,
          joinsCreated: 0,
          // Distribution of listings by number of IDs found
          listingsWithZeroIds: 0,
          listingsWithOneId: 0,
          listingsWithTwoIds: 0,
          listingsWithThreeIds: 0,
          listingsWithFourIds: 0,
          listingsWithFiveOrMoreIds: 0,
          // Track extracted IDs for this batch
          extractedIds: new Set<string>(),
          validatedIds: Array<{ extractedId: string; listingId: string }>(),
          notValidatedIds: Array<{ extractedId: string; listingId: string }>(),
          // Track all processed listing IDs (including ones with zero extracted IDs)
          processedListingIds: Array<string>(),
        };

        for (const listingId of batch) {
          try {
            const stats = await reconcileService.processListing(
              listingId,
              versionToUse,
              cleanupMode
            );
            batchStats.succeeded++;
            batchStats.extracted += stats.extracted;
            batchStats.validated += stats.validated;
            batchStats.joinsCreated += stats.joinsCreated;
            
            // Track extracted IDs
            stats.extractedIds.forEach(id => batchStats.extractedIds.add(id));
            batchStats.validatedIds.push(...stats.validatedIds);
            batchStats.notValidatedIds.push(...stats.notValidatedIds);
            
            // Track processed listing ID (even if zero extracted IDs)
            batchStats.processedListingIds.push(listingId);
            
            // Track distribution by number of IDs found
            const extractedCount = stats.extractedCount;
            if (extractedCount === 0) {
              batchStats.listingsWithZeroIds++;
            } else if (extractedCount === 1) {
              batchStats.listingsWithOneId++;
            } else if (extractedCount === 2) {
              batchStats.listingsWithTwoIds++;
            } else if (extractedCount === 3) {
              batchStats.listingsWithThreeIds++;
            } else if (extractedCount === 4) {
              batchStats.listingsWithFourIds++;
            } else {
              batchStats.listingsWithFiveOrMoreIds++;
            }
          } catch (error) {
            const errorMessage =
              error instanceof Error ? error.message : 'Unknown error';
            
            // Check if this is a critical error that should fail the entire job
            const isCritical = isCriticalError(errorMessage);
            
            if (isCritical) {
              log.error({ err: error, batch: i + 1, listingId }, 'CRITICAL ERROR detected - will fail entire job');
              // Re-throw critical errors to fail the entire job
              throw error;
            }
            
            // Non-critical error - mark this listing as failed but continue
            batchStats.failed++;
            log.warn({ err: error, batch: i + 1, listingId }, 'Error reconciling listing (continuing)');
            batchStats.errors.push({
              listingId,
              error: errorMessage,
            });
          }
        }

        // Convert Sets to Arrays for serialization (Inngest steps can't serialize Sets)
        return {
          ...batchStats,
          extractedIds: Array.from(batchStats.extractedIds),
          // validatedIds and notValidatedIds are already arrays, no conversion needed
        };
      });

      result.succeeded += batchResult.succeeded;
      result.failed += batchResult.failed;
      result.errors.push(...batchResult.errors);
      result.totalExtracted += batchResult.extracted;
      result.totalValidated += batchResult.validated;
      result.totalJoinsCreated += batchResult.joinsCreated;
      // Aggregate distribution statistics
      result.listingsWithZeroIds += batchResult.listingsWithZeroIds;
      result.listingsWithOneId += batchResult.listingsWithOneId;
      result.listingsWithTwoIds += batchResult.listingsWithTwoIds;
      result.listingsWithThreeIds += batchResult.listingsWithThreeIds;
      result.listingsWithFourIds += batchResult.listingsWithFourIds;
      result.listingsWithFiveOrMoreIds += batchResult.listingsWithFiveOrMoreIds;
      // Aggregate processed listing IDs
      result.processedListingIds.push(...(batchResult.processedListingIds || []));
      // Aggregate extracted IDs
      if (Array.isArray(batchResult.extractedIds)) {
        batchResult.extractedIds.forEach((id: string) => result.allExtractedIds.add(id));
      }
      if (Array.isArray(batchResult.validatedIds)) {
        result.allValidatedIds.push(...batchResult.validatedIds);
      }
      if (Array.isArray(batchResult.notValidatedIds)) {
        result.allNotValidatedIds.push(...batchResult.notValidatedIds);
      }

      // Update progress after each batch
      await step.run(`update-progress-batch-${i}`, async () => {
        const jobService = new BaseJobService(supabaseServer);
        await jobService.updateJobProgress(
          jobId,
          `Reconciling listing ${(i + 1) * BATCH_SIZE} of ${listingIdsToReconcile.length}...`,
          {
            listings_found: listingIdsToReconcile.length,
            listings_processed: result.succeeded,
            listings_failed: result.failed,
            extracted: result.totalExtracted,
            validated: result.totalValidated,
            joins_created: result.totalJoinsCreated,
          }
        );
      });
    }

    // Step 5: Complete or fail job
    const finalStatus =
      result.failed === listingIdsToReconcile.length ? 'failed' : 'completed';
    const finalMessage =
      result.failed > 0 && result.succeeded === 0
        ? `All ${listingIdsToReconcile.length} listings failed to reconcile`
        : result.failed > 0
        ? `Completed: ${result.succeeded} reconciled successfully, ${result.failed} failed`
        : `Completed: ${result.succeeded} listings reconciled successfully`;

    await step.run('complete-job', async () => {
      const jobService = new BaseJobService(supabaseServer);
      
      // Prepare metadata with distribution statistics and extracted IDs
      const extractedIdsArray = Array.from(result.allExtractedIds).sort();
      const metadata = {
        total_listings_input: listingIdsToReconcile.length,
        processed_listing_ids: result.processedListingIds.sort(), // All processed listing IDs (including zero extracted IDs)
        distribution: {
          listings_with_zero_ids: result.listingsWithZeroIds,
          listings_with_one_id: result.listingsWithOneId,
          listings_with_two_ids: result.listingsWithTwoIds,
          listings_with_three_ids: result.listingsWithThreeIds,
          listings_with_four_ids: result.listingsWithFourIds,
          listings_with_five_or_more_ids: result.listingsWithFiveOrMoreIds,
        },
        total_joins_created: result.totalJoinsCreated,
        extracted_ids: {
          total_extracted: extractedIdsArray.length,
          total_validated: result.allValidatedIds.length,
          total_not_validated: result.allNotValidatedIds.length,
          validated_ids: result.allValidatedIds.sort((a, b) => {
            // Sort by extractedId first, then listingId
            if (a.extractedId !== b.extractedId) {
              return a.extractedId.localeCompare(b.extractedId);
            }
            return a.listingId.localeCompare(b.listingId);
          }),
          not_validated_ids: result.allNotValidatedIds.sort((a, b) => {
            // Sort by extractedId first, then listingId
            if (a.extractedId !== b.extractedId) {
              return a.extractedId.localeCompare(b.extractedId);
            }
            return a.listingId.localeCompare(b.listingId);
          }),
        },
      };
      
      if (finalStatus === 'failed') {
        await jobService.failJob(
          jobId,
          result.failed > 0 && result.succeeded === 0
            ? `All ${listingIdsToReconcile.length} listings failed to reconcile`
            : `${result.failed} of ${listingIdsToReconcile.length} listings failed to reconcile`
        );
        
        // Store metadata even for failed jobs
        await supabaseServer
          .schema('pipeline')
          .from('jobs')
          .update({
            metadata: metadata as Json,
          })
          .eq('id', jobId);
      } else {
        await jobService.completeJob(
          jobId,
          {
            listings_found: listingIdsToReconcile.length,
            listings_processed: result.succeeded,
            listings_failed: result.failed,
            extracted: result.totalExtracted,
            validated: result.totalValidated,
            joins_created: result.totalJoinsCreated,
          },
          finalMessage
        );
        
        // Store detailed metadata about ID distribution
        await supabaseServer
          .schema('pipeline')
          .from('jobs')
          .update({
            metadata: metadata as Json,
          })
          .eq('id', jobId);
      }
    });

      return {
        jobId,
        total: listingIdsToReconcile.length,
        succeeded: result.succeeded,
        failed: result.failed,
        errors: result.errors,
      };
    } catch (error) {
      // Handle critical errors that should fail the entire job
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const isCritical = isCriticalError(errorMessage);
      
      log.error({ err: error, isCritical }, 'Error in reconcile job');
      
      // Mark job as failed if it was created
      if (jobId) {
        await step.run('fail-job-on-error', async () => {
          const jobService = new BaseJobService(supabaseServer);
          const failureMessage = isCritical
            ? `Critical error: ${errorMessage}`
            : `Job error: ${errorMessage}`;
          await jobService.failJob(jobId, failureMessage);
        });
      }
      
      // Re-throw to let Inngest know the function failed
      throw error;
    }
  }
);
