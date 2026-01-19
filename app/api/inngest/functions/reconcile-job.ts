// Inngest function for reconcile jobs
// Handles long-running reconcile jobs by breaking work into batches

import { inngest } from '@/lib/inngest/client';
import { supabaseServer } from '@/lib/supabase/server';
import { BaseJobService } from '@/lib/jobs/base-job-service';
import {
  ReconcileService,
} from '@/lib/analyze/reconcile-service';
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

export const reconcileJob = inngest.createFunction(
  { id: INNGEST_FUNCTION_IDS.RECONCILE_JOB },
  { event: 'job/reconcile.triggered' },
  async ({ event, step }) => {
    console.log('[Reconcile Job] Starting reconcile job...');
    console.log('[Reconcile Job] Event data:', JSON.stringify(event.data, null, 2));
    
    const {
      listingIds,
      limit,
      reconciliationVersion,
      cleanupMode = 'supersede',
      rerun = false,
    } = event.data;

    // Use provided version or default to current version
    const versionToUse =
      reconciliationVersion || ReconcileService.RECONCILIATION_VERSION;
    
    console.log('[Reconcile Job] Configuration:', {
      reconciliationVersion: versionToUse,
      cleanupMode,
      rerun,
      hasListingIds: !!listingIds,
      listingIdsCount: listingIds?.length || 0,
      limit: limit || 'no limit',
    });

    // Step 1: Create job record
    console.log('[Reconcile Job] Step 1: Creating job record...');
    const job = await step.run('create-job', async () => {
      const jobService = new BaseJobService(supabaseServer);
      const createdJob = await jobService.createJob(
        'reconcile' as JobType,
        'all', // Marketplace doesn't really apply to reconcile
        {
          listingIds: listingIds || null,
          limit: limit || null,
          reconciliationVersion: versionToUse,
          cleanupMode: cleanupMode,
          rerun: rerun,
        }
      );
      console.log('[Reconcile Job] Job created:', { jobId: createdJob.id, status: createdJob.status });
      return createdJob;
    });

    const jobId = job.id;
    console.log('[Reconcile Job] Job ID:', jobId);

    // Step 2: Initialize reconcile service
    console.log('[Reconcile Job] Step 2: Initializing reconcile service...');
    const reconcileService = new ReconcileService(supabaseServer);
    console.log('[Reconcile Job] Reconcile service initialized');

    // Step 3: Get listings to reconcile
    console.log('[Reconcile Job] Step 3: Getting listings to reconcile...');
    let listingIdsToReconcile: string[];

    if (listingIds && listingIds.length > 0) {
      // Use provided listing IDs
      console.log('[Reconcile Job] Using provided listing IDs:', listingIds.length);
      listingIdsToReconcile = listingIds;

      await step.run('update-progress-found', async () => {
        const jobService = new BaseJobService(supabaseServer);
        await jobService.updateJobProgress(
          jobId,
          `Found ${listingIds.length} listings to reconcile...`,
          { listings_found: listingIds.length }
        );
      });
      console.log('[Reconcile Job] Using', listingIds.length, 'provided listing IDs');
    } else {
      // Find listings that have not yet been reconciled
      console.log('[Reconcile Job] No listing IDs provided, finding unreconciled listings...');
      await step.run('update-progress-finding', async () => {
        const jobService = new BaseJobService(supabaseServer);
        await jobService.updateJobProgress(
          jobId,
          'Finding listings to reconcile...'
        );
      });

      listingIdsToReconcile = await step.run('find-listings', async () => {
        console.log('[Reconcile Job] Querying listings table directly for listings to reconcile...');
        
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

        // Apply limit if provided (we'll filter after fetching)
        if (limit) {
          // Fetch more than limit to account for filtering, but cap at reasonable number
          query = query.limit(limit * 2);
        }

        const { data: listings, error: listingsError } = await query;

        if (listingsError) {
          console.error('[Reconcile Job] Error fetching listings:', listingsError);
          throw new Error(
            `Failed to fetch listings: ${listingsError.message}`
          );
        }

        if (!listings || listings.length === 0) {
          console.log('[Reconcile Job] No active listings found, returning empty array');
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

        console.log('[Reconcile Job] Filter results:', {
          totalListings: listings.length,
          needsReconciliation: listingsToReconcile.length,
          alreadyReconciled: listings.length - listingsToReconcile.length,
          rerun: rerun,
        });

        let listingIds = listingsToReconcile.map((l) => l.id);

        // Apply limit if provided
        if (limit) {
          listingIds = listingIds.slice(0, limit);
          console.log('[Reconcile Job] Applied limit:', listingIds.length, 'of', listingsToReconcile.length);
        }

        console.log('[Reconcile Job] Returning', listingIds.length, 'listing IDs to reconcile');
        return listingIds;
      });

      if (listingIdsToReconcile.length === 0) {
        console.log('[Reconcile Job] No listings found to reconcile, completing job with no work');
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
        console.log('[Reconcile Job] Job completed with no work');
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
    console.log('[Reconcile Job] Step 4: Processing', listingIdsToReconcile.length, 'listings in batches');
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
    };

    const batches = Math.ceil(listingIdsToReconcile.length / BATCH_SIZE);
    console.log('[Reconcile Job] Will process', batches, 'batches of up to', BATCH_SIZE, 'listings each');

    for (let i = 0; i < batches; i++) {
      const start = i * BATCH_SIZE;
      const end = Math.min(start + BATCH_SIZE, listingIdsToReconcile.length);
      const batch = listingIdsToReconcile.slice(start, end);

      console.log(`[Reconcile Job] Processing batch ${i + 1}/${batches}: listings ${start + 1}-${end} (${batch.length} listings)`);

      // Process batch
      const batchResult = await step.run(`process-batch-${i}`, async () => {
        console.log(`[Reconcile Job] Batch ${i + 1}: Starting to process ${batch.length} listings`);
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
        };

        for (const listingId of batch) {
          try {
            console.log(`[Reconcile Job] Batch ${i + 1}: Processing listing ${listingId}`);
            const stats = await reconcileService.processListing(
              listingId,
              versionToUse,
              cleanupMode
            );
            console.log(`[Reconcile Job] Batch ${i + 1}: Listing ${listingId} processed successfully:`, {
              extracted: stats.extracted,
              validated: stats.validated,
              joinsCreated: stats.joinsCreated,
              extractedCount: stats.extractedCount,
            });
            batchStats.succeeded++;
            batchStats.extracted += stats.extracted;
            batchStats.validated += stats.validated;
            batchStats.joinsCreated += stats.joinsCreated;
            
            // Track extracted IDs
            stats.extractedIds.forEach(id => batchStats.extractedIds.add(id));
            batchStats.validatedIds.push(...stats.validatedIds);
            batchStats.notValidatedIds.push(...stats.notValidatedIds);
            
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
            batchStats.failed++;
            const errorMessage =
              error instanceof Error ? error.message : 'Unknown error';
            console.error(`[Reconcile Job] Batch ${i + 1}: Error reconciling listing ${listingId}:`, errorMessage);
            if (error instanceof Error && error.stack) {
              console.error(`[Reconcile Job] Batch ${i + 1}: Stack trace:`, error.stack);
            }
            batchStats.errors.push({
              listingId,
              error: errorMessage,
            });
          }
        }

        console.log(`[Reconcile Job] Batch ${i + 1}: Completed -`, {
          succeeded: batchStats.succeeded,
          failed: batchStats.failed,
          extracted: batchStats.extracted,
          validated: batchStats.validated,
          joinsCreated: batchStats.joinsCreated,
        });
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
      console.log(`[Reconcile Job] Batch ${i + 1}: Updating progress -`, {
        totalProcessed: result.succeeded,
        totalFailed: result.failed,
        totalExtracted: result.totalExtracted,
        totalValidated: result.totalValidated,
        totalJoinsCreated: result.totalJoinsCreated,
      });
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
    console.log('[Reconcile Job] Step 5: Completing job with final results:', {
      total: listingIdsToReconcile.length,
      succeeded: result.succeeded,
      failed: result.failed,
      totalExtracted: result.totalExtracted,
      totalValidated: result.totalValidated,
      totalJoinsCreated: result.totalJoinsCreated,
      distribution: {
        zero: result.listingsWithZeroIds,
        one: result.listingsWithOneId,
        two: result.listingsWithTwoIds,
        three: result.listingsWithThreeIds,
        four: result.listingsWithFourIds,
        fiveOrMore: result.listingsWithFiveOrMoreIds,
      },
    });
    
    const finalStatus =
      result.failed === listingIdsToReconcile.length ? 'failed' : 'completed';
    const finalMessage =
      result.failed > 0 && result.succeeded === 0
        ? `All ${listingIdsToReconcile.length} listings failed to reconcile`
        : result.failed > 0
        ? `Completed: ${result.succeeded} reconciled successfully, ${result.failed} failed`
        : `Completed: ${result.succeeded} listings reconciled successfully`;

    console.log('[Reconcile Job] Final status:', finalStatus);
    console.log('[Reconcile Job] Final message:', finalMessage);

    await step.run('complete-job', async () => {
      console.log('[Reconcile Job] Updating job record in database...');
      const jobService = new BaseJobService(supabaseServer);
      
      // Prepare metadata with distribution statistics and extracted IDs
      const extractedIdsArray = Array.from(result.allExtractedIds).sort();
      const metadata = {
        total_listings_input: listingIdsToReconcile.length,
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
        console.log('[Reconcile Job] Marking job as failed');
        await jobService.failJob(
          jobId,
          result.failed > 0 && result.succeeded === 0
            ? `All ${listingIdsToReconcile.length} listings failed to reconcile`
            : `${result.failed} of ${listingIdsToReconcile.length} listings failed to reconcile`
        );
        
        // Store metadata even for failed jobs
        console.log('[Reconcile Job] Storing metadata for failed job');
        await supabaseServer
          .schema('pipeline')
          .from('jobs')
          .update({
            metadata: metadata as Json,
          })
          .eq('id', jobId);
      } else {
        console.log('[Reconcile Job] Marking job as completed');
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
        console.log('[Reconcile Job] Storing metadata for completed job');
        await supabaseServer
          .schema('pipeline')
          .from('jobs')
          .update({
            metadata: metadata as Json,
          })
          .eq('id', jobId);
      }
      console.log('[Reconcile Job] Job record updated successfully');
    });

    console.log('[Reconcile Job] Job finished. Returning result:', {
      jobId,
      total: listingIdsToReconcile.length,
      succeeded: result.succeeded,
      failed: result.failed,
    });

    return {
      jobId,
      total: listingIdsToReconcile.length,
      succeeded: result.succeeded,
      failed: result.failed,
      errors: result.errors,
    };
  }
);
