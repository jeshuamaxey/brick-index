// Service to match listings to user searches

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Search, Listing, ListingAnalysis } from '@/lib/types';

export class MatchingService {
  constructor(private supabase: SupabaseClient) {}

  /**
   * Match listings to a search's criteria
   * @param searchId - The search ID to match against
   * @returns Array of listing IDs that match
   */
  async matchListingsToSearch(searchId: string): Promise<string[]> {
    // Fetch the search
    const { data: search, error: searchError } = await this.supabase
      .from('searches')
      .select('*')
      .eq('id', searchId)
      .single();

    if (searchError || !search) {
      throw new Error(
        `Search not found: ${searchError?.message || 'Unknown error'}`
      );
    }

    // Find listings that match the search criteria
    // For POC: only max_price_per_piece filter
    const { data: listings, error: listingsError } = await this.supabase
      .schema('pipeline')
      .from('listings')
      .select('id, listing_analysis(*)')
      .eq('status', 'active');

    if (listingsError) {
      throw new Error(
        `Failed to fetch listings: ${listingsError.message}`
      );
    }

    const matchingListingIds: string[] = [];

    for (const listing of listings || []) {
      const analysis = listing.listing_analysis as ListingAnalysis[] | null;
      const analysisData = analysis?.[0];

      // Check if listing has analysis with price_per_piece
      if (!analysisData || !analysisData.price_per_piece) {
        continue;
      }

      // Check if price_per_piece is within the search criteria
      if (analysisData.price_per_piece <= search.max_price_per_piece) {
        matchingListingIds.push(listing.id);
      }
    }

    return matchingListingIds;
  }

  /**
   * Match all active searches against new/updated listings
   * @param listingIds - Optional array of listing IDs to check (if not provided, checks all active listings)
   * @returns Map of search_id -> matching listing IDs
   */
  async matchAllSearches(
    listingIds?: string[]
  ): Promise<Map<string, string[]>> {
    // Fetch all active searches
    const { data: searches, error: searchesError } = await this.supabase
      .from('searches')
      .select('*')
      .eq('email_alerts_enabled', true);

    if (searchesError) {
      throw new Error(
        `Failed to fetch searches: ${searchesError.message}`
      );
    }

    const results = new Map<string, string[]>();

    for (const search of searches || []) {
      try {
        const matchingIds = await this.matchListingsToSearch(search.id);
        if (matchingIds.length > 0) {
          results.set(search.id, matchingIds);
        }
      } catch (error) {
        console.error(`Error matching search ${search.id}:`, error);
      }
    }

    return results;
  }

  /**
   * Store search results (matches) in the database
   * @param searchId - The search ID
   * @param listingIds - Array of matching listing IDs
   * @returns Number of new matches stored
   */
  async storeSearchResults(
    searchId: string,
    listingIds: string[]
  ): Promise<number> {
    let newMatches = 0;

    for (const listingId of listingIds) {
      // Check if this match already exists
      const { data: existing } = await this.supabase
        .from('search_results')
        .select('id')
        .eq('search_id', searchId)
        .eq('listing_id', listingId)
        .maybeSingle();

      if (!existing) {
        // Insert new match
        const { error } = await this.supabase
          .from('search_results')
          .insert({
            search_id: searchId,
            listing_id: listingId,
            notified_at: null, // Will be set when email is sent
          });

        if (!error) {
          newMatches++;
        }
      }
    }

    return newMatches;
  }
}

