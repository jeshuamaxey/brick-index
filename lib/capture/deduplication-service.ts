// Service to handle deduplication of listings

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/supabase.types';
import { createServiceLogger, type AppLogger } from '@/lib/logging';
import type { Listing } from '@/lib/types';

export class DeduplicationService {
  private log: AppLogger;

  constructor(private supabase: SupabaseClient<Database>, parentLogger?: AppLogger) {
    this.log = parentLogger 
      ? parentLogger.child({ service: 'DeduplicationService' })
      : createServiceLogger('DeduplicationService');
  }

  /**
   * Check if a listing already exists in the database
   * @param marketplace - The marketplace identifier
   * @param externalId - The external ID from the marketplace
   * @returns The existing listing ID if found, null otherwise
   */
  async findExistingListing(
    marketplace: string,
    externalId: string
  ): Promise<string | null> {
    const { data, error } = await this.supabase
      .schema('pipeline')
      .from('listings')
      .select('id')
      .eq('marketplace', marketplace)
      .eq('external_id', externalId)
      .maybeSingle();

    if (error) {
      this.log.error({ err: error, marketplace, externalId }, 'Error checking for existing listing');
      throw error;
    }

    return data?.id || null;
  }

  /**
   * Check if multiple listings exist
   * @param listings - Array of listings with marketplace and external_id
   * @returns Map of (marketplace, external_id) -> listing_id for existing listings
   */
  async findExistingListings(
    listings: Array<{ marketplace: string; external_id: string }>
  ): Promise<Map<string, string>> {
    const existingMap = new Map<string, string>();

    // Query each listing individually to check for existence
    // This is simpler and more reliable than complex OR queries
    for (const listing of listings) {
      try {
        const { data, error } = await this.supabase
          .schema('pipeline')
          .from('listings')
          .select('id, marketplace, external_id')
          .eq('marketplace', listing.marketplace)
          .eq('external_id', listing.external_id)
          .maybeSingle();

        if (error && error.code !== 'PGRST116') {
          // PGRST116 is "not found" which is fine
          this.log.warn({ err: error, marketplace: listing.marketplace, externalId: listing.external_id }, 'Error checking listing (continuing)');
          continue;
        }

        if (data) {
          const key = `${data.marketplace}:${data.external_id}`;
          existingMap.set(key, data.id);
        }
      } catch (error) {
        this.log.warn({ err: error, marketplace: listing.marketplace, externalId: listing.external_id }, 'Exception checking listing (continuing)');
      }
    }

    return existingMap;
  }

  /**
   * Deduplicate a list of listings, returning only new ones
   * @param listings - Array of listings to check
   * @returns Object with new listings and existing listing IDs
   */
  async deduplicateListings(listings: Listing[]): Promise<{
    newListings: Listing[];
    existingIds: Map<string, string>;
  }> {
    const existingMap = await this.findExistingListings(
      listings.map((l) => ({
        marketplace: l.marketplace,
        external_id: l.external_id,
      }))
    );

    const newListings: Listing[] = [];
    const existingIds = new Map<string, string>();

    for (const listing of listings) {
      const key = `${listing.marketplace}:${listing.external_id}`;
      const existingId = existingMap.get(key);

      if (existingId) {
        existingIds.set(key, existingId);
      } else {
        newListings.push(listing);
      }
    }

    return { newListings, existingIds };
  }
}

