// Base interface for marketplace adapters

import type { Marketplace, RawListing, Listing } from '@/lib/types';

export interface MarketplaceAdapter {
  /**
   * Get the marketplace identifier
   */
  getMarketplace(): Marketplace;

  /**
   * Search for listings matching the given keywords
   * @param keywords - Search keywords (e.g., "lego bulk", "lego job lot")
   * @returns Array of raw API responses that will be stored in raw_listings
   */
  searchListings(keywords: string[]): Promise<Record<string, unknown>[]>;

  /**
   * Transform a raw API response into a structured Listing
   * @param rawResponse - The raw API response from the marketplace
   * @param rawListingId - The ID of the raw_listing record
   * @returns A structured Listing object
   */
  transformToListing(
    rawResponse: Record<string, unknown>,
    rawListingId: string
  ): Listing;

  /**
   * Check if a listing is still active (hasn't been sold/removed)
   * This can be used to update listing status
   * @param externalId - The marketplace's ID for the listing
   * @returns true if listing is still active
   */
  isListingActive(externalId: string): Promise<boolean>;
}

