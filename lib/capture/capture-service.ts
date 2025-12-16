// Service to orchestrate capture from all marketplaces

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Json } from '@/lib/supabase/supabase.types';
import type { MarketplaceAdapter } from './marketplace-adapters/base-adapter';
import { DeduplicationService } from './deduplication-service';
import { BaseJobService } from '@/lib/jobs/base-job-service';
import { JobProgressTracker } from '@/lib/jobs/job-progress-tracker';
import type { Job, JobType, RawListing, Listing } from '@/lib/types';

export class CaptureService {
  private deduplicationService: DeduplicationService;
  private jobService: BaseJobService;

  constructor(private supabase: SupabaseClient<Database>) {
    this.deduplicationService = new DeduplicationService(supabase);
    this.jobService = new BaseJobService(supabase);
  }

  /**
   * Capture listings from a marketplace adapter
   * @param adapter - The marketplace adapter to use
   * @param keywords - Keywords to search for
   * @param adapterParams - Optional adapter-specific parameters
   * @returns Capture job result
   */
  async captureFromMarketplace(
    adapter: MarketplaceAdapter,
    keywords: string[] = ['lego bulk', 'lego job lot', 'lego lot'],
    adapterParams?: unknown
  ): Promise<Job> {
    const marketplace = adapter.getMarketplace();
    
    // Determine job type based on marketplace
    const jobType: JobType = `${marketplace}_refresh_listings` as JobType;

    // Create job record using BaseJobService
    const job = await this.jobService.createJob(jobType, marketplace, {
      keywords,
      adapterParams: adapterParams || null,
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
      // Update progress: Searching marketplace
      await progressTracker.forceUpdate('Searching marketplace...');
      // Search for listings
      // Check if adapter supports optional params (e.g., EbayAdapter)
      let rawResponses: Record<string, unknown>[];
      if (
        adapterParams &&
        'searchListings' in adapter &&
        adapter.searchListings.length > 1
      ) {
        // Type assertion for adapters that support optional params
        rawResponses = await (adapter.searchListings as (
          keywords: string[],
          params?: unknown
        ) => Promise<Record<string, unknown>[]>)(keywords, adapterParams);
      } else {
        rawResponses = await adapter.searchListings(keywords);
      }
      const listingsFound = rawResponses.length;

      // Update progress: Found listings
      await progressTracker.forceUpdate(
        `Found ${listingsFound} listings, storing raw responses...`,
        { listings_found: listingsFound }
      );

      // Store raw responses
      const rawListingIds: string[] = [];
      progressTracker.reset();
      for (let i = 0; i < rawResponses.length; i++) {
        const rawResponse = rawResponses[i];
        const { data: rawListing, error: rawError } = await this.supabase
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
          rawListingIds.push(rawListing.id);
        }

        // Update progress periodically
        await progressTracker.recordProgress(
          `Storing raw responses: ${i + 1} of ${rawResponses.length}`,
          { listings_found: listingsFound }
        );
      }

      // Update progress: Processing listings
      await progressTracker.forceUpdate('Processing listings...', {
        listings_found: listingsFound,
      });

      // Transform raw responses to structured listings
      const listings: Listing[] = [];
      progressTracker.reset();
      for (let i = 0; i < rawResponses.length; i++) {
        const rawResponse = rawResponses[i];
        const rawListingId = rawListingIds[i];

        if (!rawListingId) continue;

        try {
          const listing = adapter.transformToListing(rawResponse, rawListingId);
          listings.push(listing);
        } catch (error) {
          console.error('Error transforming listing:', error);
        }

        // Update progress periodically
        await progressTracker.recordProgress(
          `Processing ${i + 1} of ${rawResponses.length} listings...`,
          { listings_found: listingsFound }
        );
      }

      // Update progress: Deduplicating
      await progressTracker.forceUpdate('Deduplicating listings...', {
        listings_found: listingsFound,
      });

      // Deduplicate listings
      const { newListings, existingIds } =
        await this.deduplicationService.deduplicateListings(listings);

      // Insert new listings
      let listingsNew = 0;
      if (newListings.length > 0) {
        // Omit the 'id' field so database generates it
        const listingsToInsert = newListings.map((listing) => {
          const { id, ...listingWithoutId } = listing;
          return {
            ...listingWithoutId,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            first_seen_at: new Date().toISOString(),
            last_seen_at: new Date().toISOString(),
          };
        });

        const { error: insertError } = await this.supabase
          .schema('pipeline')
          .from('listings')
          .insert(listingsToInsert);

        if (insertError) {
          console.error('Error inserting new listings:', insertError);
        } else {
          listingsNew = newListings.length;
        }
      }

      // Update existing listings (update last_seen_at)
      let listingsUpdated = 0;
      if (existingIds.size > 0) {
        const existingListingIds = Array.from(existingIds.values());
        const { error: updateError } = await this.supabase
          .schema('pipeline')
          .from('listings')
          .update({
            last_seen_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .in('id', existingListingIds);

        if (updateError) {
          console.error('Error updating existing listings:', updateError);
        } else {
          listingsUpdated = existingIds.size;
        }
      }

      // Complete job
      await this.jobService.completeJob(
        jobId,
        {
          listings_found: listingsFound,
          listings_new: listingsNew,
          listings_updated: listingsUpdated,
        },
        `Completed: Inserted ${listingsNew} new, updated ${listingsUpdated} existing listings`
      );

      // Fetch and return updated job
      const { data: completedJob, error: fetchError } = await this.supabase
        .schema('pipeline')
        .from('jobs')
        .select('*')
        .eq('id', jobId)
        .single();

      if (fetchError || !completedJob) {
        // Return what we know if fetch fails
        return {
          ...job,
          status: 'completed',
          listings_found: listingsFound,
          listings_new: listingsNew,
          listings_updated: listingsUpdated,
          completed_at: new Date().toISOString(),
        } as Job;
      }

      return completedJob as Job;
    } catch (error) {
      // Mark job as failed
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';

      await this.jobService.failJob(jobId, errorMessage);

      // Fetch and return updated job
      const { data: failedJob, error: fetchError } = await this.supabase
        .schema('pipeline')
        .from('jobs')
        .select('*')
        .eq('id', jobId)
        .single();

      if (fetchError || !failedJob) {
        // Return what we know if fetch fails
        return {
          ...job,
          status: 'failed',
          listings_found: 0,
          listings_new: 0,
          listings_updated: 0,
          completed_at: new Date().toISOString(),
          error_message: errorMessage,
        } as Job;
      }

      return failedJob as Job;
    }
  }
}

