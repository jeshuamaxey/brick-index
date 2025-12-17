// Inngest function for enrichment jobs
// Handles long-running enrichment jobs by breaking work into batches

import { inngest } from '@/lib/inngest/client';
import { supabaseServer } from '@/lib/supabase/server';
import { BaseJobService } from '@/lib/jobs/base-job-service';
import { EbayAdapter } from '@/lib/capture/marketplace-adapters/ebay-adapter';
import type { JobType } from '@/lib/types';
import type { Database, Json } from '@/lib/supabase/supabase.types';

const BATCH_SIZE = 50; // Process 50 listings per step to avoid timeout

interface EbayGetItemResponse {
  itemId?: string;
  description?: string;
  additionalImages?: Array<{ imageUrl?: string }>;
  conditionDescription?: string;
  categoryPath?: string;
  itemLocation?: {
    city?: string;
    stateOrProvince?: string;
    postalCode?: string;
    country?: string;
  };
  estimatedAvailabilities?: Array<{
    estimatedAvailabilityStatus?: string;
    estimatedAvailableQuantity?: number;
    estimatedSoldQuantity?: number;
    estimatedRemainingQuantity?: number;
  }>;
  buyingOptions?: string[];
  [key: string]: unknown;
}

interface EnrichJobEvent {
  name: 'job/enrich.triggered';
  data: {
    marketplace: string;
    limit?: number;
    delayMs?: number;
  };
}

/**
 * Extract enrichment fields from eBay getItem API response
 */
function extractEnrichmentFields(response: EbayGetItemResponse): Record<string, unknown> {
  const fields: Record<string, unknown> = {};

  // Description
  if (response.description !== undefined) {
    fields.description = response.description;
  }

  // Additional images
  if (response.additionalImages && Array.isArray(response.additionalImages)) {
    fields.additional_images = response.additionalImages
      .map((img) => img.imageUrl)
      .filter((url): url is string => typeof url === 'string');
  } else {
    fields.additional_images = [];
  }

  // Condition description
  if (response.conditionDescription !== undefined) {
    fields.condition_description = response.conditionDescription;
  }

  // Category path
  if (response.categoryPath !== undefined) {
    fields.category_path = response.categoryPath;
  }

  // Item location
  if (response.itemLocation) {
    fields.item_location = {
      city: response.itemLocation.city,
      stateOrProvince: response.itemLocation.stateOrProvince,
      postalCode: response.itemLocation.postalCode,
      country: response.itemLocation.country,
    };
  }

  // Estimated availabilities
  if (
    response.estimatedAvailabilities &&
    Array.isArray(response.estimatedAvailabilities)
  ) {
    fields.estimated_availabilities = response.estimatedAvailabilities.map(
      (avail) => ({
        estimatedAvailabilityStatus: avail.estimatedAvailabilityStatus,
        estimatedAvailableQuantity: avail.estimatedAvailableQuantity,
        estimatedSoldQuantity: avail.estimatedSoldQuantity,
        estimatedRemainingQuantity: avail.estimatedRemainingQuantity,
      })
    );
  }

  // Buying options
  if (response.buyingOptions && Array.isArray(response.buyingOptions)) {
    fields.buying_options = response.buyingOptions;
  } else {
    fields.buying_options = [];
  }

  return fields;
}

export const enrichJob = inngest.createFunction(
  { id: 'enrich-job' },
  { event: 'job/enrich.triggered' },
  async ({ event, step }) => {
    const { marketplace, limit, delayMs = 200 } = event.data;

    // Step 1: Create job record
    const job = await step.run('create-job', async () => {
      const jobService = new BaseJobService(supabaseServer);
      const jobType: JobType = `${marketplace}_enrich_listings` as JobType;
      return await jobService.createJob(jobType, marketplace, {
        limit: limit || null,
        delayMs,
        marketplace,
      });
    });

    const jobId = job.id;

    // Step 3: Update progress - querying
    await step.run('update-progress-querying', async () => {
      const jobService = new BaseJobService(supabaseServer);
      await jobService.updateJobProgress(jobId, 'Querying unenriched listings...');
    });

    // Step 4: Query unenriched listings
    const listings = await step.run('query-listings', async () => {
      let query = supabaseServer
        .schema('pipeline')
        .from('listings')
        .select('id, external_id, marketplace')
        .is('enriched_at', null)
        .eq('status', 'active')
        .eq('marketplace', marketplace);

      if (limit) {
        query = query.limit(limit);
      }

      const { data, error } = await query;

      if (error) {
        throw new Error(`Failed to query listings: ${error.message}`);
      }

      return data || [];
    });

    if (listings.length === 0) {
      // Complete job with no work
      await step.run('complete-job-no-work', async () => {
        const jobService = new BaseJobService(supabaseServer);
        await jobService.completeJob(
          jobId,
          { listings_found: 0, listings_new: 0, listings_updated: 0 },
          'No listings found to enrich'
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

    // Step 5: Update progress - found listings
    await step.run('update-progress-found', async () => {
      const jobService = new BaseJobService(supabaseServer);
      await jobService.updateJobProgress(
        jobId,
        `Found ${listings.length} listings to enrich...`,
        { listings_found: listings.length }
      );
    });

    // Step 6: Process listings in batches
    const result = {
      succeeded: 0,
      failed: 0,
      errors: [] as Array<{ listingId: string; error: string }>,
    };

    const batches = Math.ceil(listings.length / BATCH_SIZE);

    for (let i = 0; i < batches; i++) {
      const start = i * BATCH_SIZE;
      const end = Math.min(start + BATCH_SIZE, listings.length);
      const batch = listings.slice(start, end);

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
          errors: [] as Array<{ listingId: string; error: string }>,
        };

        for (const listing of batch) {
          try {
            // Call getItemDetails API
            const enrichedResponse = await getItemDetails(listing.external_id);

            // Store raw enriched response
            const { data: rawListing, error: rawError } = await supabaseServer
              .schema('pipeline')
              .from('raw_listings')
              .insert({
                marketplace,
                api_response: enrichedResponse as Json,
              })
              .select('id')
              .single();

            if (rawError) {
              throw new Error(`Failed to store raw listing: ${rawError.message}`);
            }

            if (!rawListing) {
              throw new Error('Failed to store raw listing: No ID returned');
            }

            // Extract fields from enriched response
            const ebayResponse = enrichedResponse as EbayGetItemResponse;
            const extractedFields = extractEnrichmentFields(ebayResponse);

            // Update listing with enriched data
            const { error: updateError } = await supabaseServer
              .schema('pipeline')
              .from('listings')
              .update({
                ...extractedFields,
                enriched_at: new Date().toISOString(),
                enriched_raw_listing_id: rawListing.id,
                updated_at: new Date().toISOString(),
              })
              .eq('id', listing.id);

            if (updateError) {
              throw new Error(`Failed to update listing: ${updateError.message}`);
            }

            batchStats.succeeded++;
          } catch (error) {
            batchStats.failed++;
            const errorMessage =
              error instanceof Error ? error.message : 'Unknown error';
            batchStats.errors.push({
              listingId: listing.id,
              error: errorMessage,
            });
            console.error(
              `Error enriching listing ${listing.id} (${listing.external_id}):`,
              errorMessage
            );
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
          `Enriching listing ${(i + 1) * BATCH_SIZE} of ${listings.length}...`,
          {
            listings_found: listings.length,
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

    // Step 7: Update metadata with errors
    await step.run('update-metadata', async () => {
      const { error: metadataError } = await supabaseServer
        .schema('pipeline')
        .from('jobs')
        .update({
          metadata: {
            limit: limit || null,
            delayMs,
            marketplace,
            errors: result.errors,
          } as Json,
        })
        .eq('id', jobId);

      if (metadataError) {
        console.error('Error updating job metadata:', metadataError);
      }
    });

    // Step 8: Complete or fail job
    const finalStatus = result.failed === listings.length ? 'failed' : 'completed';
    const finalMessage =
      result.failed > 0 && result.succeeded === 0
        ? `All ${listings.length} listings failed to enrich`
        : result.failed > 0
        ? `Completed: ${result.succeeded} succeeded, ${result.failed} failed`
        : `Completed: ${result.succeeded} listings enriched successfully`;

    await step.run('complete-job', async () => {
      const jobService = new BaseJobService(supabaseServer);
      if (finalStatus === 'failed') {
        await jobService.failJob(
          jobId,
          result.failed > 0 && result.succeeded === 0
            ? `All ${listings.length} listings failed to enrich`
            : `${result.failed} of ${listings.length} listings failed to enrich`
        );
      } else {
        await jobService.completeJob(
          jobId,
          {
            listings_found: listings.length,
            listings_new: result.succeeded,
            listings_updated: result.failed,
          },
          finalMessage
        );
      }
    });

    return {
      jobId,
      total: listings.length,
      succeeded: result.succeeded,
      failed: result.failed,
      errors: result.errors,
    };
  }
);
