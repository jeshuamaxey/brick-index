// Inngest function for capture jobs
// Handles long-running capture jobs by breaking work into steps

import { inngest } from '@/lib/inngest/client';
import { supabaseServer } from '@/lib/supabase/server';
import { BaseJobService } from '@/lib/jobs/base-job-service';
import { DeduplicationService } from '@/lib/capture/deduplication-service';
import { EbayAdapter } from '@/lib/capture/marketplace-adapters/ebay-adapter';
import { EbaySnapshotAdapter } from '@/lib/capture/marketplace-adapters/ebay-snapshot-adapter';
import type { MarketplaceAdapter } from '@/lib/capture/marketplace-adapters/base-adapter';
import type { JobType, Listing } from '@/lib/types';
import type { Database, Json } from '@/lib/supabase/supabase.types';

const BATCH_SIZE = 50; // Process 50 items per step to avoid timeout

interface CaptureJobEvent {
  name: 'job/capture.triggered';
  data: {
    marketplace: string;
    keywords?: string[];
    ebayParams?: unknown;
  };
}

export const captureJob = inngest.createFunction(
  { id: 'capture-job' },
  { event: 'job/capture.triggered' },
  async ({ event, step }) => {
    const { marketplace, keywords = ['lego bulk', 'lego job lot', 'lego lot'], ebayParams } = event.data;

    // Step 1: Create job record
    const job = await step.run('create-job', async () => {
      const jobService = new BaseJobService(supabaseServer);
      const jobType: JobType = `${marketplace}_refresh_listings` as JobType;
      return await jobService.createJob(jobType, marketplace, {
        keywords,
        adapterParams: ebayParams || null,
      });
    });

    const jobId = job.id;

    // Step 2: Update progress - searching
    await step.run('update-progress-searching', async () => {
      const jobService = new BaseJobService(supabaseServer);
      await jobService.updateJobProgress(jobId, 'Searching marketplace...');
    });

    // Step 3: Search marketplace (create adapter inside this step)
    const rawResponses = await step.run('search-marketplace', async () => {
      // Create adapter based on marketplace and EBAY_DATA_MODE
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

      // Check if adapter supports optional params
      if (ebayParams && 'searchListings' in adapter && adapter.searchListings.length > 1) {
        return await (adapter.searchListings as (
          keywords: string[],
          params?: unknown
        ) => Promise<Record<string, unknown>[]>)(keywords, ebayParams);
      } else {
        return await adapter.searchListings(keywords);
      }
    });

    const listingsFound = rawResponses.length;

    // Step 5: Update progress - found listings
    await step.run('update-progress-found', async () => {
      const jobService = new BaseJobService(supabaseServer);
      await jobService.updateJobProgress(
        jobId,
        `Found ${listingsFound} listings, storing raw responses...`,
        { listings_found: listingsFound }
      );
    });

    // Step 6: Store raw responses in batches
    const rawListingIds: string[] = [];
    const batches = Math.ceil(rawResponses.length / BATCH_SIZE);

    for (let i = 0; i < batches; i++) {
      const start = i * BATCH_SIZE;
      const end = Math.min(start + BATCH_SIZE, rawResponses.length);
      const batch = rawResponses.slice(start, end);

      const batchIds = await step.run(`store-raw-batch-${i}`, async () => {
        const ids: string[] = [];
        for (const rawResponse of batch) {
          const { data: rawListing, error: rawError } = await supabaseServer
            .schema('pipeline')
            .from('raw_listings')
            .insert({
              marketplace,
              api_response: rawResponse as Json,
            })
            .select('id')
            .single();

          if (rawError) {
            console.error('Error storing raw listing:', rawError);
            continue;
          }

          if (rawListing) {
            ids.push(rawListing.id);
          }
        }
        return ids;
      });

      rawListingIds.push(...batchIds);

      // Update progress after each batch
      await step.run(`update-progress-storing-${i}`, async () => {
        const jobService = new BaseJobService(supabaseServer);
        await jobService.updateJobProgress(
          jobId,
          `Storing raw responses: ${rawListingIds.length} of ${rawResponses.length}`,
          { listings_found: listingsFound }
        );
      });
    }

    // Step 7: Update progress - processing
    await step.run('update-progress-processing', async () => {
      const jobService = new BaseJobService(supabaseServer);
      await jobService.updateJobProgress(jobId, 'Processing listings...', {
        listings_found: listingsFound,
      });
    });

    // Step 8: Transform listings in batches
    const listings: Listing[] = [];
    for (let i = 0; i < batches; i++) {
      const start = i * BATCH_SIZE;
      const end = Math.min(start + BATCH_SIZE, rawResponses.length);
      const batch = rawResponses.slice(start, end);
      const batchIds = rawListingIds.slice(start, end);

      const transformed = await step.run(`transform-batch-${i}`, async () => {
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
        for (let j = 0; j < batch.length; j++) {
          const rawResponse = batch[j];
          const rawListingId = batchIds[j];

          if (!rawListingId) continue;

          try {
            const listing = adapter.transformToListing(rawResponse, rawListingId);
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
          jobId,
          `Processing ${listings.length} of ${rawResponses.length} listings...`,
          { listings_found: listingsFound }
        );
      });
    }

    // Step 9: Update progress - deduplicating
    await step.run('update-progress-deduplicating', async () => {
      const jobService = new BaseJobService(supabaseServer);
      await jobService.updateJobProgress(jobId, 'Deduplicating listings...', {
        listings_found: listingsFound,
      });
    });

    // Step 10: Deduplicate listings
    const { newListings, existingIdsArray } = await step.run('deduplicate', async () => {
      const deduplicationService = new DeduplicationService(supabaseServer);
      const { newListings, existingIds } = await deduplicationService.deduplicateListings(listings);
      // Convert Map to array for serialization between steps
      return {
        newListings,
        existingIdsArray: Array.from(existingIds.values()),
      };
    });

    // Step 11: Insert new listings in batches
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

    // Step 12: Update existing listings
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

    // Step 13: Complete job
    await step.run('complete-job', async () => {
      const jobService = new BaseJobService(supabaseServer);
      await jobService.completeJob(
        jobId,
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
  }
);
