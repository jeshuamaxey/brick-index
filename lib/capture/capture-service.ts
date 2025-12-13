// Service to orchestrate capture from all marketplaces

import type { SupabaseClient } from '@supabase/supabase-js';
import type { MarketplaceAdapter } from './marketplace-adapters/base-adapter';
import { DeduplicationService } from './deduplication-service';
import type { CaptureJob, RawListing, Listing } from '@/lib/types';

export class CaptureService {
  private deduplicationService: DeduplicationService;

  constructor(private supabase: SupabaseClient) {
    this.deduplicationService = new DeduplicationService(supabase);
  }

  /**
   * Capture listings from a marketplace adapter
   * @param adapter - The marketplace adapter to use
   * @param keywords - Keywords to search for
   * @returns Capture job result
   */
  async captureFromMarketplace(
    adapter: MarketplaceAdapter,
    keywords: string[] = ['lego bulk', 'lego job lot', 'lego lot']
  ): Promise<CaptureJob> {
    const marketplace = adapter.getMarketplace();
    const jobId = crypto.randomUUID();

    // Create capture job record
    const { data: job, error: jobError } = await this.supabase
      .schema('pipeline')
      .from('capture_jobs')
      .insert({
        id: jobId,
        marketplace,
        status: 'running',
        listings_found: 0,
        listings_new: 0,
        listings_updated: 0,
        started_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (jobError) {
      console.error('Capture job creation error:', jobError);
      console.error('Error details:', {
        code: jobError.code,
        message: jobError.message,
        details: jobError.details,
        hint: jobError.hint,
        fullError: JSON.stringify(jobError, Object.getOwnPropertyNames(jobError), 2),
      });
      throw new Error(
        `Failed to create capture job: ${jobError.message || jobError.details || jobError.hint || JSON.stringify(jobError)}`
      );
    }

    if (!job) {
      throw new Error('Failed to create capture job: No data returned');
    }

    try {
      // Search for listings
      const rawResponses = await adapter.searchListings(keywords);
      const listingsFound = rawResponses.length;

      // Store raw responses
      const rawListingIds: string[] = [];
      for (const rawResponse of rawResponses) {
        const { data: rawListing, error: rawError } = await this.supabase
          .schema('pipeline')
          .from('raw_listings')
          .insert({
            marketplace,
            api_response: rawResponse,
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
      }

      // Transform raw responses to structured listings
      const listings: Listing[] = [];
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
      }

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

      // Update capture job
      const { error: updateJobError } = await this.supabase
        .schema('pipeline')
        .from('capture_jobs')
        .update({
          status: 'completed',
          listings_found: listingsFound,
          listings_new: listingsNew,
          listings_updated: listingsUpdated,
          completed_at: new Date().toISOString(),
        })
        .eq('id', jobId);

      if (updateJobError) {
        console.error('Error updating capture job:', updateJobError);
      }

      return {
        id: jobId,
        marketplace,
        status: 'completed',
        listings_found: listingsFound,
        listings_new: listingsNew,
        listings_updated: listingsUpdated,
        started_at: new Date(job.started_at),
        completed_at: new Date(),
        error_message: null,
      };
    } catch (error) {
      // Update capture job with error
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';

      await this.supabase
        .schema('pipeline')
        .from('capture_jobs')
        .update({
          status: 'failed',
          completed_at: new Date().toISOString(),
          error_message: errorMessage,
        })
        .eq('id', jobId);

      return {
        id: jobId,
        marketplace,
        status: 'failed',
        listings_found: 0,
        listings_new: 0,
        listings_updated: 0,
        started_at: new Date(job.started_at),
        completed_at: new Date(),
        error_message: errorMessage,
      };
    }
  }
}

