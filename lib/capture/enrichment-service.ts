// Service to enrich listings with detailed information from marketplace APIs

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Json } from '@/lib/supabase/supabase.types';
import type { JobType } from '@/lib/types';
import type { MarketplaceAdapter } from './marketplace-adapters/base-adapter';
import { EbayAdapter } from './marketplace-adapters/ebay-adapter';
import { BaseJobService } from '@/lib/jobs/base-job-service';
import { JobProgressTracker } from '@/lib/jobs/job-progress-tracker';

export interface EnrichmentResult {
  jobId: string;
  total: number;
  succeeded: number;
  failed: number;
  errors: Array<{ listingId: string; error: string }>;
}

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

export class EnrichmentService {
  private jobService: BaseJobService;

  constructor(private supabase: SupabaseClient<Database>) {
    this.jobService = new BaseJobService(supabase);
  }

  /**
   * Enrich listings with detailed information from marketplace APIs
   * @param adapter - The marketplace adapter to use (must support getItemDetails)
   * @param options - Enrichment options
   * @returns Enrichment result with statistics
   */
  async enrichListings(
    adapter: MarketplaceAdapter,
    options: {
      marketplace?: string;
      limit?: number;
      delayMs?: number;
    } = {}
  ): Promise<EnrichmentResult> {
    const marketplace = options.marketplace || adapter.getMarketplace();
    const limit = options.limit;
    const delayMs = options.delayMs ?? 200;
    
    // Determine job type based on marketplace
    const jobType: JobType = `${marketplace}_enrich_listings` as JobType;

    // Check if adapter supports getItemDetails (currently only EbayAdapter)
    if (!('getItemDetails' in adapter)) {
      throw new Error(
        `Adapter for marketplace "${marketplace}" does not support item enrichment`
      );
    }

    const getItemDetails = (adapter as EbayAdapter).getItemDetails.bind(
      adapter as EbayAdapter
    );

    // Create job record using BaseJobService
    const job = await this.jobService.createJob(jobType, marketplace, {
      limit: limit || null,
      delayMs,
      marketplace,
    });

    const jobId = job.id;

    // Create progress tracker
    const progressTracker = new JobProgressTracker({
      milestoneInterval: 10,
      timeIntervalMs: 5000,
      onUpdate: async (update) => {
        await this.jobService.updateJobProgress(jobId, update.message, update.stats);
      },
    });

    try {
      // Update progress: Querying listings
      await progressTracker.forceUpdate('Querying unenriched listings...');

      // Query for unenriched listings
      let query = this.supabase
        .schema('pipeline')
        .from('listings')
        .select('id, external_id, marketplace')
        .is('enriched_at', null)
        .eq('status', 'active')
        .eq('marketplace', marketplace);

      if (limit) {
        query = query.limit(limit);
      }

      const { data: listings, error: queryError } = await query;

      if (queryError) {
        await this.jobService.failJob(
          jobId,
          `Failed to query listings: ${queryError.message}`
        );
        throw new Error(`Failed to query listings: ${queryError.message}`);
      }

      if (!listings || listings.length === 0) {
        // Complete job with no work
        await this.jobService.completeJob(
          jobId,
          { listings_found: 0, listings_new: 0, listings_updated: 0 },
          'No listings found to enrich'
        );
        
        return {
          jobId,
          total: 0,
          succeeded: 0,
          failed: 0,
          errors: [],
        };
      }

      // Update progress: Found listings
      await progressTracker.forceUpdate(
        `Found ${listings.length} listings to enrich...`,
        { listings_found: listings.length }
      );

      const result: EnrichmentResult = {
        jobId,
        total: listings.length,
        succeeded: 0,
        failed: 0,
        errors: [],
      };

      progressTracker.reset();

      // Process each listing
      for (let i = 0; i < listings.length; i++) {
        const listing = listings[i];
        try {
          // Add delay between API calls to respect rate limits
          if (delayMs > 0 && result.total > 1) {
            await new Promise((resolve) => setTimeout(resolve, delayMs));
          }

          // Call getItemDetails API
          const enrichedResponse = await getItemDetails(listing.external_id);

          // Store raw enriched response
          const { data: rawListing, error: rawError } = await this.supabase
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
          const extractedFields = this.extractEnrichmentFields(ebayResponse);

          // Update listing with enriched data
          const { error: updateError } = await this.supabase
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

          result.succeeded++;
        } catch (error) {
          result.failed++;
          const errorMessage =
            error instanceof Error ? error.message : 'Unknown error';
          result.errors.push({
            listingId: listing.id,
            error: errorMessage,
          });
          console.error(
            `Error enriching listing ${listing.id} (${listing.external_id}):`,
            errorMessage
          );
        }

        // Update progress periodically
        await progressTracker.recordProgress(
          `Enriching listing ${i + 1} of ${listings.length}...`,
          {
            listings_found: listings.length,
            listings_new: result.succeeded,
            listings_updated: result.failed,
          }
        );
      }

      // Update metadata with errors
      const { error: metadataError } = await this.supabase
        .schema('pipeline')
        .from('jobs')
        .update({
          metadata: {
            ...(job.metadata as Record<string, unknown> || {}),
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

      // Complete or fail job
      const finalStatus = result.failed === result.total ? 'failed' : 'completed';
      const finalMessage =
        result.failed > 0 && result.succeeded === 0
          ? `All ${result.total} listings failed to enrich`
          : result.failed > 0
          ? `Completed: ${result.succeeded} succeeded, ${result.failed} failed`
          : `Completed: ${result.succeeded} listings enriched successfully`;

      if (finalStatus === 'failed') {
        await this.jobService.failJob(
          jobId,
          result.failed > 0 && result.succeeded === 0
            ? `All ${result.total} listings failed to enrich`
            : `${result.failed} of ${result.total} listings failed to enrich`
        );
      } else {
        await this.jobService.completeJob(
          jobId,
          {
            listings_found: result.total,
            listings_new: result.succeeded,
            listings_updated: result.failed,
          },
          finalMessage
        );
      }

      return result;
    } catch (error) {
      // Mark job as failed if not already handled
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      await this.jobService.failJob(jobId, errorMessage);
      throw error;
    }
  }

  /**
   * Extract enrichment fields from eBay getItem API response
   */
  private extractEnrichmentFields(
    response: EbayGetItemResponse
  ): Record<string, unknown> {
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
}

