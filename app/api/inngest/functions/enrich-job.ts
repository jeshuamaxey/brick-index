// Inngest function for enrichment jobs
// Handles long-running enrichment jobs by breaking work into batches

import { inngest } from '@/lib/inngest/client';
import { supabaseServer } from '@/lib/supabase/server';
import { BaseJobService } from '@/lib/jobs/base-job-service';
import { EbayAdapter } from '@/lib/capture/marketplace-adapters/ebay-adapter';
import type { JobType } from '@/lib/types';
import type { Database, Json } from '@/lib/supabase/supabase.types';

const BATCH_SIZE = 50; // Process 50 listings per step to avoid timeout

interface EnrichJobEvent {
  name: 'job/enrich.triggered';
  data: {
    marketplace: string;
    captureJobId?: string; // Optional: enrich specific capture job's raw listings
    limit?: number;
    delayMs?: number;
  };
}

// Note: extractEnrichmentFields is no longer used here since we store raw data
// and extract fields during materialisation. Keeping for reference if needed.

import { INNGEST_FUNCTION_IDS } from './registry';

export const enrichJob = inngest.createFunction(
  { id: INNGEST_FUNCTION_IDS.ENRICH_JOB },
  { event: 'job/enrich.triggered' },
  async ({ event, step }) => {
    const { marketplace, captureJobId, limit, delayMs = 200 } = event.data;

    // Step 1: Create job record
    const job = await step.run('create-job', async () => {
      const jobService = new BaseJobService(supabaseServer);
      const jobType: JobType = `${marketplace}_enrich_listings` as JobType;
      return await jobService.createJob(jobType, marketplace, {
        limit: limit || null,
        delayMs,
        marketplace,
        captureJobId: captureJobId || null,
      });
    });

    const jobId = job.id;

    // Step 2: Update progress - querying
    await step.run('update-progress-querying', async () => {
      const jobService = new BaseJobService(supabaseServer);
      await jobService.updateJobProgress(jobId, 'Querying unenriched raw listings...');
    });

    // Step 3: Query unenriched raw listings
    const rawListings = await step.run('query-raw-listings', async () => {
      let query = supabaseServer
        .schema('pipeline')
        .from('raw_listings')
        .select('id, api_response, marketplace')
        .is('enriched_at', null)
        .eq('marketplace', marketplace);

      // Filter by capture job if provided
      if (captureJobId) {
        query = query.eq('job_id', captureJobId);
      }

      if (limit) {
        query = query.limit(limit);
      }

      const { data, error } = await query;

      if (error) {
        throw new Error(`Failed to query raw listings: ${error.message}`);
      }

      return data || [];
    });

    if (rawListings.length === 0) {
      // Complete job with no work
      await step.run('complete-job-no-work', async () => {
        const jobService = new BaseJobService(supabaseServer);
        await jobService.completeJob(
          jobId,
          { listings_found: 0, listings_new: 0, listings_updated: 0 },
          'No raw listings found to enrich'
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

    // Step 4: Update progress - found raw listings
    await step.run('update-progress-found', async () => {
      const jobService = new BaseJobService(supabaseServer);
      await jobService.updateJobProgress(
        jobId,
        `Found ${rawListings.length} raw listings to enrich...`,
        { listings_found: rawListings.length }
      );
    });

    // Step 5: Process raw listings in batches
    const result = {
      succeeded: 0,
      failed: 0,
      errors: [] as Array<{ rawListingId: string; error: string }>,
    };

    const batches = Math.ceil(rawListings.length / BATCH_SIZE);

    for (let i = 0; i < batches; i++) {
      const start = i * BATCH_SIZE;
      const end = Math.min(start + BATCH_SIZE, rawListings.length);
      const batch = rawListings.slice(start, end);

      // Process batch
      const batchResult = await step.run(`process-batch-${i}`, async () => {
        // Create adapter inside step (can't serialize between steps)
        if (marketplace !== 'ebay') {
          throw new Error(`Unsupported marketplace: ${marketplace}`);
        }

        const ebayAppId = process.env.EBAY_APP_ID;
        if (!ebayAppId) {
          throw new Error(
            'EBAY_APP_ID environment variable is required for enrichment'
          );
        }

        const adapter = new EbayAdapter(ebayAppId);

        // Check if adapter supports getItemDetails
        if (!('getItemDetails' in adapter)) {
          throw new Error(
            `Adapter for marketplace "${marketplace}" does not support item enrichment`
          );
        }

        const getItemDetails = adapter.getItemDetails.bind(adapter);

        const batchStats = {
          succeeded: 0,
          failed: 0,
          errors: [] as Array<{ rawListingId: string; error: string }>,
        };

        for (const rawListing of batch) {
          try {
            // Extract itemId from raw_listings.api_response
            const apiResponse = rawListing.api_response as Record<string, unknown>;
            const itemId = apiResponse.itemId as string | undefined;

            if (!itemId) {
              throw new Error('itemId not found in raw_listings.api_response');
            }

            // Call getItemDetails API
            const enrichedResponse = await getItemDetails(itemId);

            // Store enriched response in raw_listing_details table
            const { data: rawListingDetail, error: detailError } = await supabaseServer
              .schema('pipeline')
              .from('raw_listing_details')
              .insert({
                raw_listing_id: rawListing.id,
                job_id: jobId,
                marketplace,
                api_response: enrichedResponse as Json,
              })
              .select('id')
              .single();

            if (detailError) {
              throw new Error(`Failed to store raw listing detail: ${detailError.message}`);
            }

            if (!rawListingDetail) {
              throw new Error('Failed to store raw listing detail: No ID returned');
            }

            // Update raw_listings.enriched_at timestamp
            const enrichedAt = new Date().toISOString();
            const { error: updateError } = await supabaseServer
              .schema('pipeline')
              .from('raw_listings')
              .update({
                enriched_at: enrichedAt,
              })
              .eq('id', rawListing.id);

            if (updateError) {
              throw new Error(`Failed to update raw_listings.enriched_at: ${updateError.message}`);
            }

            batchStats.succeeded++;
          } catch (error) {
            batchStats.failed++;
            const errorMessage =
              error instanceof Error ? error.message : 'Unknown error';
            batchStats.errors.push({
              rawListingId: rawListing.id,
              error: errorMessage,
            });
            console.error(
              `Error enriching raw listing ${rawListing.id}:`,
              errorMessage
            );

            // If this is an "Item not found" error (404), mark the corresponding listing(s) as expired
            // A 404 from eBay Browse API means the item is no longer available for purchase
            // (could be sold, ended, removed, or temporarily disabled)
            if (errorMessage.startsWith('Item not found:')) {
              try {
                // Extract itemId from the error message or from api_response
                const apiResponse = rawListing.api_response as Record<string, unknown>;
                const itemId = apiResponse.itemId as string | undefined;

                if (itemId) {
                  // Find and update corresponding listing(s) in the listings table
                  const { error: updateStatusError } = await supabaseServer
                    .schema('pipeline')
                    .from('listings')
                    .update({
                      status: 'expired',
                      updated_at: new Date().toISOString(),
                    })
                    .eq('external_id', itemId)
                    .eq('marketplace', marketplace);

                  if (updateStatusError) {
                    console.error(
                      `Failed to update listing status for itemId ${itemId}:`,
                      updateStatusError
                    );
                  } else {
                    console.log(
                      `Marked listing(s) with external_id ${itemId} as expired due to Item not found error`
                    );
                  }
                }
              } catch (statusUpdateError) {
                // Log but don't fail the entire batch if status update fails
                console.error(
                  `Error updating listing status for raw listing ${rawListing.id}:`,
                  statusUpdateError
                );
              }
            }
          }
        }

        return batchStats;
      });

      result.succeeded += batchResult.succeeded;
      result.failed += batchResult.failed;
      result.errors.push(...batchResult.errors);

      // Update progress after each batch
      await step.run(`update-progress-batch-${i}`, async () => {
        const jobService = new BaseJobService(supabaseServer);
        await jobService.updateJobProgress(
          jobId,
          `Enriching raw listing ${(i + 1) * BATCH_SIZE} of ${rawListings.length}...`,
          {
            listings_found: rawListings.length,
            listings_new: result.succeeded,
            listings_updated: result.failed,
          }
        );
      });

      // Rate limiting delay between batches (except for last batch)
      if (i < batches - 1 && delayMs > 0) {
        await step.sleep(`rate-limit-delay-${i}`, `${delayMs}ms`);
      }
    }

    // Step 6: Update metadata with errors
    await step.run('update-metadata', async () => {
      const { error: metadataError } = await supabaseServer
        .schema('pipeline')
        .from('jobs')
        .update({
          metadata: {
            limit: limit || null,
            delayMs,
            marketplace,
            captureJobId: captureJobId || null,
            errors: result.errors,
          } as Json,
        })
        .eq('id', jobId);

      if (metadataError) {
        console.error('Error updating job metadata:', metadataError);
      }
    });

    // Step 7: Complete or fail job
    const finalStatus = result.failed === rawListings.length ? 'failed' : 'completed';
    const finalMessage =
      result.failed > 0 && result.succeeded === 0
        ? `All ${rawListings.length} raw listings failed to enrich`
        : result.failed > 0
        ? `Completed: ${result.succeeded} succeeded, ${result.failed} failed`
        : `Completed: ${result.succeeded} raw listings enriched successfully`;

    await step.run('complete-job', async () => {
      const jobService = new BaseJobService(supabaseServer);
      if (finalStatus === 'failed') {
        await jobService.failJob(
          jobId,
          result.failed > 0 && result.succeeded === 0
            ? `All ${rawListings.length} raw listings failed to enrich`
            : `${result.failed} of ${rawListings.length} raw listings failed to enrich`
        );
      } else {
        await jobService.completeJob(
          jobId,
          {
            listings_found: rawListings.length,
            listings_new: result.succeeded,
            listings_updated: result.failed,
          },
          finalMessage
        );
      }
    });

    return {
      jobId,
      total: rawListings.length,
      succeeded: result.succeeded,
      failed: result.failed,
      errors: result.errors,
    };
  }
);

