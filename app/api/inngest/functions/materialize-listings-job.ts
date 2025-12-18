// Inngest function for materializing listings
// Transforms raw listings from raw_listings table into listings table

import { inngest } from '@/lib/inngest/client';
import { supabaseServer } from '@/lib/supabase/server';
import { BaseJobService } from '@/lib/jobs/base-job-service';
import { DeduplicationService } from '@/lib/capture/deduplication-service';
import { EbayAdapter } from '@/lib/capture/marketplace-adapters/ebay-adapter';
import { EbaySnapshotAdapter } from '@/lib/capture/marketplace-adapters/ebay-snapshot-adapter';
import type { MarketplaceAdapter } from '@/lib/capture/marketplace-adapters/base-adapter';
import type { JobType, Listing } from '@/lib/types';

const BATCH_SIZE = 50; // Process 50 items per step to avoid timeout

interface MaterializeJobEvent {
  name: 'job/materialize.triggered';
  data: {
    captureJobId: string;
    marketplace: string;
  };
}

import { INNGEST_FUNCTION_IDS } from './registry';

export const materializeListingsJob = inngest.createFunction(
  { id: INNGEST_FUNCTION_IDS.MATERIALIZE_LISTINGS_JOB },
  { event: 'job/materialize.triggered' },
  async ({ event, step }) => {
    let jobId: string | null = null;

    try {
      const { captureJobId, marketplace } = event.data;

      // Step 1: Create materialize job record
      const job = await step.run('create-job', async () => {
        const jobService = new BaseJobService(supabaseServer);
        const jobType: JobType = `${marketplace}_materialize_listings` as JobType;
        return await jobService.createJob(jobType, marketplace, {
          captureJobId,
        });
      });

      jobId = job.id;

      // Step 2: Get raw listing IDs from capture job
      const rawListingIds = await step.run('get-raw-listing-ids', async () => {
        const { data: rawListings, error } = await supabaseServer
          .schema('pipeline')
          .from('raw_listings')
          .select('id')
          .eq('job_id', captureJobId);

        if (error) {
          throw new Error(`Failed to fetch raw listings: ${error.message}`);
        }

        if (!rawListings || rawListings.length === 0) {
          throw new Error(`No raw listings found for capture job ${captureJobId}`);
        }

        return rawListings.map((rl) => rl.id);
      });

      const listingsFound = rawListingIds.length;

      // Step 3: Update progress - found raw listings
      await step.run('update-progress-found', async () => {
        const jobService = new BaseJobService(supabaseServer);
        await jobService.updateJobProgress(
          jobId!,
          `Found ${listingsFound} raw listings to materialize...`,
          { listings_found: listingsFound }
        );
      });

      // Step 4: Transform listings in batches (query from database)
      const listings: Listing[] = [];
      const batches = Math.ceil(rawListingIds.length / BATCH_SIZE);

      for (let i = 0; i < batches; i++) {
        const start = i * BATCH_SIZE;
        const end = Math.min(start + BATCH_SIZE, rawListingIds.length);
        const batchIds = rawListingIds.slice(start, end);

        const transformed = await step.run(`transform-batch-${i}`, async () => {
          // Fetch raw listings from database
          const { data: rawListings, error: fetchError } = await supabaseServer
            .schema('pipeline')
            .from('raw_listings')
            .select('*')
            .in('id', batchIds);

          if (fetchError || !rawListings) {
            console.error('Error fetching raw listings:', fetchError);
            return [];
          }

          // Create adapter again (can't serialize between steps)
          let adapter: MarketplaceAdapter;
          if (marketplace === 'ebay') {
            const ebayAppId = process.env.EBAY_APP_ID;
            const dataMode = process.env.EBAY_DATA_MODE ?? 'live';

            if (dataMode === 'cache') {
              adapter = new EbaySnapshotAdapter();
            } else {
              if (!ebayAppId) {
                throw new Error(
                  'EBAY_APP_ID is required when EBAY_DATA_MODE=live. Either set EBAY_DATA_MODE=cache or provide EBAY_APP_ID.'
                );
              }
              adapter = new EbayAdapter(ebayAppId);
            }
          } else {
            throw new Error(`Unsupported marketplace: ${marketplace}`);
          }

          const transformedListings: Listing[] = [];
          for (const rawListing of rawListings) {
            try {
              const listing = adapter.transformToListing(
                rawListing.api_response as Record<string, unknown>,
                rawListing.id
              );
              transformedListings.push(listing);
            } catch (error) {
              console.error('Error transforming listing:', error);
            }
          }
          return transformedListings;
        });

        listings.push(...transformed);

        // Update progress after each batch
        await step.run(`update-progress-transforming-${i}`, async () => {
          const jobService = new BaseJobService(supabaseServer);
          await jobService.updateJobProgress(
            jobId!,
            `Processing ${listings.length} of ${listingsFound} listings...`,
            { listings_found: listingsFound }
          );
        });
      }

      // Step 5: Update progress - deduplicating
      await step.run('update-progress-deduplicating', async () => {
        const jobService = new BaseJobService(supabaseServer);
        await jobService.updateJobProgress(jobId!, 'Deduplicating listings...', {
          listings_found: listingsFound,
        });
      });

      // Step 6: Deduplicate listings
      const { newListings, existingIdsArray } = await step.run('deduplicate', async () => {
        const deduplicationService = new DeduplicationService(supabaseServer);
        const { newListings, existingIds } = await deduplicationService.deduplicateListings(listings);
        // Convert Map to array for serialization between steps
        return {
          newListings,
          existingIdsArray: Array.from(existingIds.values()),
        };
      });

      // Step 7: Insert new listings in batches
      let listingsNew = 0;
      if (newListings.length > 0) {
        const newBatches = Math.ceil(newListings.length / BATCH_SIZE);
        for (let i = 0; i < newBatches; i++) {
          const start = i * BATCH_SIZE;
          const end = Math.min(start + BATCH_SIZE, newListings.length);
          const batch = newListings.slice(start, end);

          const inserted = await step.run(`insert-batch-${i}`, async () => {
            const listingsToInsert = batch.map((listing) => {
              const { id, ...listingWithoutId } = listing;
              return {
                ...listingWithoutId,
                job_id: jobId!, // Associate with materialize job
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                first_seen_at: new Date().toISOString(),
                last_seen_at: new Date().toISOString(),
              };
            });

            const { error: insertError } = await supabaseServer
              .schema('pipeline')
              .from('listings')
              .insert(listingsToInsert);

            if (insertError) {
              console.error('Error inserting new listings:', insertError);
              return 0;
            }
            return batch.length;
          });

          listingsNew += inserted;
        }
      }

      // Step 8: Update existing listings
      let listingsUpdated = 0;
      if (existingIdsArray && existingIdsArray.length > 0) {
        const updateBatches = Math.ceil(existingIdsArray.length / BATCH_SIZE);

        for (let i = 0; i < updateBatches; i++) {
          const start = i * BATCH_SIZE;
          const end = Math.min(start + BATCH_SIZE, existingIdsArray.length);
          const batch = existingIdsArray.slice(start, end) as string[];

          const updated = await step.run(`update-batch-${i}`, async () => {
            const { error: updateError } = await supabaseServer
              .schema('pipeline')
              .from('listings')
              .update({
                last_seen_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              })
              .in('id', batch);

            if (updateError) {
              console.error('Error updating existing listings:', updateError);
              return 0;
            }
            return batch.length;
          });

          listingsUpdated += updated;
        }
      }

      // Step 9: Complete job
      await step.run('complete-job', async () => {
        const jobService = new BaseJobService(supabaseServer);
        await jobService.completeJob(
          jobId!,
          {
            listings_found: listingsFound,
            listings_new: listingsNew,
            listings_updated: listingsUpdated,
          },
          `Completed: Inserted ${listingsNew} new, updated ${listingsUpdated} existing listings`
        );
      });

      return {
        jobId,
        status: 'completed',
        listings_found: listingsFound,
        listings_new: listingsNew,
        listings_updated: listingsUpdated,
      };
    } catch (error) {
      // Mark job as failed if it was created
      if (jobId) {
        await step.run('fail-job', async () => {
          const jobService = new BaseJobService(supabaseServer);
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          await jobService.failJob(jobId!, errorMessage);
        });
      }

      // Re-throw to let Inngest know function failed
      throw error;
    }
  }
);

