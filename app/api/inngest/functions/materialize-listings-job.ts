// Inngest function for materializing listings
// Transforms raw listings from raw_listings table into listings table

import { inngest } from '@/lib/inngest/client';
import { supabaseServer } from '@/lib/supabase/server';
import { BaseJobService } from '@/lib/jobs/base-job-service';
import { DeduplicationService } from '@/lib/capture/deduplication-service';
import { EbayAdapter } from '@/lib/capture/marketplace-adapters/ebay-adapter';
import { EbaySnapshotAdapter } from '@/lib/capture/marketplace-adapters/ebay-snapshot-adapter';
import { extractEnrichmentFields } from '@/lib/capture/enrichment-utils';
import type { MarketplaceAdapter } from '@/lib/capture/marketplace-adapters/base-adapter';
import type { JobType, Listing } from '@/lib/types';
import type { Json } from '@/lib/supabase/supabase.types';

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

      // Step 4: Process batches: transform, deduplicate, insert/update all in one step
      // This ensures we only return counts (not full listing objects) to keep step outputs small
      let listingsNew = 0;
      let listingsUpdated = 0;
      const batches = Math.ceil(rawListingIds.length / BATCH_SIZE);

      for (let i = 0; i < batches; i++) {
        const start = i * BATCH_SIZE;
        const end = Math.min(start + BATCH_SIZE, rawListingIds.length);
        const batchIds = rawListingIds.slice(start, end);

        // Process entire batch in one step: transform -> deduplicate -> insert/update
        // Return only counts to keep step output small
        const batchResult = await step.run(`process-batch-${i}`, async () => {
          // 1. Fetch raw listings
          const { data: rawListings, error: fetchError } = await supabaseServer
            .schema('pipeline')
            .from('raw_listings')
            .select('*')
            .in('id', batchIds);

          if (fetchError || !rawListings) {
            console.error('Error fetching raw listings:', fetchError);
            return { new: 0, updated: 0 };
          }

          // 2. Fetch enrichment details for these raw listings
          const { data: rawListingDetails, error: detailsError } = await supabaseServer
            .schema('pipeline')
            .from('raw_listing_details')
            .select('id, raw_listing_id, api_response')
            .in('raw_listing_id', batchIds);

          if (detailsError) {
            console.error('Error fetching raw listing details:', detailsError);
            // Continue without enrichment data rather than failing
          }

          // 3. Create a map of raw_listing_id -> raw_listing_details for quick lookup
          const detailsMap = new Map<string, { id: string; api_response: Json }>();
          if (rawListingDetails) {
            for (const detail of rawListingDetails) {
              detailsMap.set(detail.raw_listing_id, {
                id: detail.id,
                api_response: detail.api_response,
              });
            }
          }

          // 4. Create adapter (can't serialize between steps)
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

          // 5. Transform listings
          const transformedListings: Listing[] = [];
          for (const rawListing of rawListings) {
            try {
              // Transform base listing from search API response
              const listing = adapter.transformToListing(
                rawListing.api_response as Record<string, unknown>,
                rawListing.id
              );

              // If enrichment data exists, extract and merge enrichment fields
              const enrichmentDetail = detailsMap.get(rawListing.id);
              if (enrichmentDetail && enrichmentDetail.api_response) {
                // Extract enrichment fields from raw_listing_details
                const enrichmentFields = extractEnrichmentFields(
                  enrichmentDetail.api_response as Record<string, unknown>
                );

                // Merge enrichment fields into listing
                Object.assign(listing, enrichmentFields);

                // Set enriched_raw_listing_id to point to raw_listing_details.id
                listing.enriched_raw_listing_id = enrichmentDetail.id;
              }

              transformedListings.push(listing);
            } catch (error) {
              console.error('Error transforming listing:', error);
            }
          }

          // 6. Deduplicate (checks database for existing listings - handles cross-batch duplicates correctly)
          const deduplicationService = new DeduplicationService(supabaseServer);
          const { newListings, existingIds } = await deduplicationService.deduplicateListings(transformedListings);

          // 7. Insert new listings
          let newCount = 0;
          if (newListings.length > 0) {
            const listingsToInsert = newListings.map((listing) => {
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
            } else {
              newCount = newListings.length;
            }
          }

          // 8. Update existing listings
          let updatedCount = 0;
          if (existingIds.size > 0) {
            const existingIdsArray = Array.from(existingIds.values());
            const { error: updateError } = await supabaseServer
              .schema('pipeline')
              .from('listings')
              .update({
                last_seen_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              })
              .in('id', existingIdsArray);

            if (updateError) {
              console.error('Error updating existing listings:', updateError);
            } else {
              updatedCount = existingIdsArray.length;
            }
          }

          // Return only counts, not full listing objects
          return { new: newCount, updated: updatedCount };
        });

        listingsNew += batchResult.new;
        listingsUpdated += batchResult.updated;

        // Update progress after each batch
        await step.run(`update-progress-batch-${i}`, async () => {
          const jobService = new BaseJobService(supabaseServer);
          await jobService.updateJobProgress(
            jobId!,
            `Processing batch ${i + 1} of ${batches} (${listingsNew} new, ${listingsUpdated} updated)...`,
            { listings_found: listingsFound }
          );
        });
      }

      // Step 5: Complete job
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

