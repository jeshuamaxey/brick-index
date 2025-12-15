// eBay Browse API adapter (RESTful API)

import type { Marketplace, Listing } from '@/lib/types';
import type { MarketplaceAdapter } from './base-adapter';

interface EbayBrowseApiResponse {
  itemSummaries?: Array<{
    itemId?: string;
    title?: string;
    itemWebUrl?: string;
    image?: {
      imageUrl?: string;
    };
    price?: {
      value?: string;
      currency?: string;
    };
    condition?: string;
    conditionId?: string;
    seller?: {
      username?: string;
      feedbackScore?: number;
      feedbackPercentage?: string;
    };
    itemLocation?: {
      city?: string;
      stateOrProvince?: string;
      country?: string;
      postalCode?: string;
    };
    shortDescription?: string;
    itemEndDate?: string;
    estimatedAvailabilityStatus?: string;
  }>;
  total?: number;
  warnings?: Array<{
    category?: string;
    message?: string;
  }>;
}

interface EbayBrowseItem {
  itemId?: string;
  title?: string;
  itemWebUrl?: string;
  image?: {
    imageUrl?: string;
  };
  price?: {
    value?: string;
    currency?: string;
  };
  condition?: string;
  conditionId?: string;
  seller?: {
    username?: string;
    feedbackScore?: number;
    feedbackPercentage?: string;
  };
  itemLocation?: {
    city?: string;
    stateOrProvince?: string;
    country?: string;
    postalCode?: string;
  };
  shortDescription?: string;
  itemEndDate?: string;
  estimatedAvailabilityStatus?: string;
}

export interface EbaySearchParams {
  entriesPerPage?: number;
  listingTypes?: string[]; // e.g., ['FIXED_PRICE', 'AUCTION']
  hideDuplicateItems?: boolean;
  categoryId?: string;
  marketplaceId?: string; // e.g., 'EBAY_US', 'EBAY_GB'
}

export class EbayAdapter implements MarketplaceAdapter {
  private appId: string;
  private baseUrl: string;
  private oauthToken?: string;
  private defaultMarketplaceId: string;
  private browseBaseUrl: string;

  constructor(appId: string, oauthToken?: string) {
    if (!appId) {
      throw new Error('eBay App ID is required');
    }
    if (!oauthToken) {
      throw new Error(
        'eBay OAuth token is required for Browse API. Set EBAY_OAUTH_APP_TOKEN in your environment.'
      );
    }
    this.appId = appId;
    this.oauthToken = oauthToken;

    // Support both production and sandbox/staging environments.
    const environment = process.env.EBAY_ENVIRONMENT ?? 'production';
    const isSandbox = environment === 'sandbox';
    this.baseUrl = isSandbox
      ? 'https://api.sandbox.ebay.com/buy/browse/v1'
      : 'https://api.ebay.com/buy/browse/v1';

    // browseBaseUrl is the same as baseUrl for Browse API
    this.browseBaseUrl = this.baseUrl;

    // Default marketplace ID (can be overridden in search params)
    this.defaultMarketplaceId =
      process.env.EBAY_MARKETPLACE_ID || 'EBAY_US';
  }

  getMarketplace(): Marketplace {
    return 'ebay';
  }

  async searchListings(
    keywords: string[],
    params?: EbaySearchParams
  ): Promise<Record<string, unknown>[]> {
    const keywordQuery = keywords.join(' ');
    const url = new URL(`${this.baseUrl}/item_summary/search`);

    // Required query parameter: q (search query)
    url.searchParams.set('q', keywordQuery);

    // Optional parameters
    if (params?.entriesPerPage !== undefined) {
      url.searchParams.set('limit', params.entriesPerPage.toString());
    } else {
      // Default limit
      url.searchParams.set('limit', '100');
    }

    // Category filter
    if (params?.categoryId !== undefined) {
      url.searchParams.set('category_ids', params.categoryId);
    }

    // Buying options filter (FIXED_PRICE, AUCTION, etc.)
    if (params?.listingTypes && params.listingTypes.length > 0) {
      // Browse API uses 'buyingOptions' filter
      // Map legacy listing types to Browse API buying options
      const buyingOptions: string[] = [];
      for (const type of params.listingTypes) {
        if (type === 'FixedPrice' || type === 'FIXED_PRICE') {
          buyingOptions.push('FIXED_PRICE');
        } else if (type === 'Auction' || type === 'AuctionWithBIN' || type === 'AUCTION') {
          buyingOptions.push('AUCTION');
        }
      }
      if (buyingOptions.length > 0) {
        buyingOptions.forEach((option) => {
          url.searchParams.append('filter', `buyingOptions:{${option}}`);
        });
      }
    }

    // Hide duplicate items (not directly supported in Browse API, but we can filter results)
    // Note: Browse API doesn't have a direct equivalent, so we'll skip this for now

    try {
      // Build headers - Browse API requires OAuth Bearer token
      const headers: HeadersInit = {
        Authorization: `Bearer ${this.oauthToken}`,
        'Content-Type': 'application/json',
      };

      // Set marketplace ID header
      const marketplaceId = params?.marketplaceId || this.defaultMarketplaceId;
      headers['X-EBAY-C-MARKETPLACE-ID'] = marketplaceId;

      const response = await fetch(url.toString(), {
        method: 'GET',
        headers,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `eBay API error: ${response.status} ${response.statusText}. ${errorText}`
        );
      }

      const data = (await response.json()) as EbayBrowseApiResponse;

      // Handle warnings if present
      if (data.warnings && data.warnings.length > 0) {
        console.warn('eBay API warnings:', data.warnings);
      }

      const items = data.itemSummaries || [];

      // Return raw API responses for storage in raw_listings
      return items.map((item) => ({
        itemId: item.itemId,
        title: item.title,
        ...item,
      }));
    } catch (error) {
      console.error('Error fetching eBay listings:', error);
      throw error;
    }
  }

  transformToListing(
    rawResponse: Record<string, unknown>,
    rawListingId: string
  ): Listing {
    const item = rawResponse as unknown as EbayBrowseItem;

    const itemId = item.itemId || '';
    const title = item.title || '';
    const itemWebUrl = item.itemWebUrl || '';
    const imageUrl = item.image?.imageUrl || '';
    const location =
      item.itemLocation?.city && item.itemLocation?.stateOrProvince
        ? `${item.itemLocation.city}, ${item.itemLocation.stateOrProvince}`
        : item.itemLocation?.city || item.itemLocation?.stateOrProvince || null;
    const sellerUserName = item.seller?.username || null;
    const feedbackScore = item.seller?.feedbackScore;
    const sellerRating = feedbackScore ? feedbackScore : null;

    // Extract price
    const priceValue = item.price?.value;
    const price = priceValue ? parseFloat(priceValue) : null;
    const currency = item.price?.currency || null;

    // Extract description
    const description = item.shortDescription || null;

    // Check if item is still active (not ended)
    const itemEndDate = item.itemEndDate
      ? new Date(item.itemEndDate)
      : null;
    const isActive =
      !itemEndDate || itemEndDate > new Date() || item.estimatedAvailabilityStatus === 'IN_STOCK';

    return {
      id: '', // Will be generated by database
      raw_listing_id: rawListingId,
      marketplace: 'ebay',
      external_id: itemId,
      title,
      description,
      price,
      currency,
      url: itemWebUrl,
      image_urls: imageUrl ? [imageUrl] : [],
      location,
      seller_name: sellerUserName,
      seller_rating: sellerRating,
      created_at: new Date(),
      updated_at: new Date(),
      first_seen_at: new Date(),
      last_seen_at: new Date(),
      status: isActive ? 'active' : 'expired',
      // Enrichment fields - will be populated by enrichment service
      enriched_at: null,
      enriched_raw_listing_id: null,
      additional_images: [],
      condition_description: null,
      category_path: null,
      item_location: null,
      estimated_availabilities: null,
      buying_options: [],
    };
  }

  async isListingActive(externalId: string): Promise<boolean> {
    // For now, we'll assume listings are active if they exist
    // In a full implementation, we'd call the Browse API getItem endpoint to check status
    // This is a placeholder
    return true;
  }

  /**
   * Get detailed item information from eBay Browse API
   * @param itemId - The eBay item ID (legacy format is accepted)
   * @returns Raw API response from getItem endpoint
   */
  async getItemDetails(itemId: string): Promise<Record<string, unknown>> {
    if (!itemId) {
      throw new Error('Item ID is required');
    }

    // The Browse API accepts both RESTful format (v1|...) and legacy format
    // Since we get legacy IDs from the search API, we can use them directly
    const url = `${this.browseBaseUrl}/item/${encodeURIComponent(itemId)}`;

    try {
      // eBay Browse API authentication - requires OAuth Bearer token
      const headers: HeadersInit = {
        Authorization: `Bearer ${this.oauthToken}`,
        'X-EBAY-C-MARKETPLACE-ID': this.defaultMarketplaceId,
        'Accept': 'application/json',
      };

      const response = await fetch(url, {
        headers,
      });

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error(`Item not found: ${itemId}`);
        }
        if (response.status === 429) {
          throw new Error('Rate limit exceeded. Please retry after delay.');
        }
        const errorText = await response.text();
        throw new Error(
          `eBay Browse API error: ${response.status} ${response.statusText}. ${errorText}`
        );
      }

      const data = await response.json();
      return data as Record<string, unknown>;
    } catch (error) {
      if (error instanceof Error) {
        console.error(`Error fetching eBay item details for ${itemId}:`, error.message);
        throw error;
      }
      throw new Error(`Unknown error fetching item details for ${itemId}`);
    }
  }
}
