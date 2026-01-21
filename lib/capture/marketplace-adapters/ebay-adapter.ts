// eBay Browse API adapter (RESTful API)

import type { Marketplace, Listing } from '@/lib/types';
import type { MarketplaceAdapter } from './base-adapter';
import { getEbayAccessToken } from '@/lib/ebay/oauth-token-service';
import { EbayApiUsageTracker } from '@/lib/ebay/api-usage-tracker';
import { createServiceLogger, type AppLogger } from '@/lib/logging';
import type { SupabaseClient } from '@supabase/supabase-js';

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
  limit?: number;
  offset?: number;
  next?: string;
  prev?: string;
  href?: string;
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
  entriesPerPage?: number; // 1-200, default: 200
  listingTypes?: string[]; // e.g., ['FIXED_PRICE', 'AUCTION']
  hideDuplicateItems?: boolean;
  categoryId?: string;
  marketplaceId?: string; // e.g., 'EBAY_US', 'EBAY_GB'
  enablePagination?: boolean; // default: true
  maxResults?: number; // default: 10000, max: 10000
  fieldgroups?: string; // default: 'EXTENDED'
}

export class EbayAdapter implements MarketplaceAdapter {
  private appId: string;
  private baseUrl: string;
  private oauthToken?: string;
  private defaultMarketplaceId: string;
  private browseBaseUrl: string;
  private usageTracker: EbayApiUsageTracker | null = null;
  private trackerInitialized: boolean = false;
  private log: AppLogger;

  constructor(appId: string, oauthToken?: string, parentLogger?: AppLogger) {
    if (!appId) {
      throw new Error('eBay App ID is required');
    }
    // oauthToken is optional - if not provided, will be fetched automatically via OAuth service
    // This maintains backward compatibility for testing/mocking scenarios
    this.appId = appId;
    this.oauthToken = oauthToken;

    // Support both production and sandbox/staging environments.
    const environment = process.env.EBAY_ENVIRONMENT ?? 'PRODUCTION';
    const isSandbox = environment === 'SANDBOX';
    this.baseUrl = isSandbox
      ? 'https://api.sandbox.ebay.com/buy/browse/v1'
      : 'https://api.ebay.com/buy/browse/v1';

    // browseBaseUrl is the same as baseUrl for Browse API
    this.browseBaseUrl = this.baseUrl;

    // Default marketplace ID (can be overridden in search params)
    this.defaultMarketplaceId =
      process.env.EBAY_MARKETPLACE_ID || 'EBAY_US';
    
    this.log = parentLogger 
      ? parentLogger.child({ service: 'EbayAdapter' })
      : createServiceLogger('EbayAdapter');
  }

  /**
   * Initialize usage tracker lazily
   * Uses appropriate Supabase client based on context (API route vs script)
   */
  private async ensureUsageTracker(): Promise<EbayApiUsageTracker | null> {
    if (this.trackerInitialized) {
      return this.usageTracker;
    }

    try {
      const supabase = await EbayApiUsageTracker.getSupabaseClient();
      this.usageTracker = new EbayApiUsageTracker(supabase);
      this.trackerInitialized = true;
      return this.usageTracker;
    } catch (error) {
      this.log.warn({ err: error }, 'Failed to initialize API usage tracker (non-critical)');
      // Don't throw - tracking failures shouldn't break API calls
      this.trackerInitialized = true;
      return null;
    }
  }

  getMarketplace(): Marketplace {
    return 'ebay';
  }

  /**
   * Ensure we have a valid OAuth token.
   * If a token was provided in the constructor, use it.
   * Otherwise, fetch a new token using the OAuth service.
   */
  private async ensureToken(): Promise<string> {
    if (this.oauthToken) {
      return this.oauthToken;
    }
    // Fetch token automatically using OAuth service
    this.oauthToken = await getEbayAccessToken();
    return this.oauthToken;
  }

  /**
   * Track an API call (fire-and-forget)
   */
  private async trackApiCall(
    response: Response,
    endpointType: 'item_summary_search' | 'get_item'
  ): Promise<void> {
    try {
      const tracker = await this.ensureUsageTracker();
      if (!tracker) {
        return; // Tracker not available, skip tracking
      }

      const responseHeaders = EbayApiUsageTracker.headersToObject(response.headers);
      await tracker.recordApiCall({
        app_id: this.appId,
        endpoint_type: endpointType,
        called_at: new Date(),
        response_status: response.status,
        response_headers: responseHeaders,
        error_message: !response.ok ? `${response.status} ${response.statusText}` : undefined,
      });
    } catch (error) {
      // Silently fail - tracking should never break API calls
      // Error already logged in ensureUsageTracker if needed
    }
  }

  /**
   * Make a single API call to fetch a page of results
   * Public method to allow direct calls from Inngest step functions
   */
  async fetchPage(
    keywordQuery: string,
    limit: number,
    offset: number,
    fieldgroups: string,
    params: EbaySearchParams | undefined,
    token: string,
    marketplaceId: string
  ): Promise<EbayBrowseApiResponse> {
    const url = new URL(`${this.baseUrl}/item_summary/search`);

    // Required query parameter: q (search query)
    url.searchParams.set('q', keywordQuery);

    // Set limit and offset for pagination
    url.searchParams.set('limit', limit.toString());
    url.searchParams.set('offset', offset.toString());

    // Set fieldgroups for extended data
    url.searchParams.set('fieldgroups', fieldgroups);

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

    // Build headers - Browse API requires OAuth Bearer token
    const headers: HeadersInit = {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'X-EBAY-C-MARKETPLACE-ID': marketplaceId,
    };

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers,
    });

    // Track API usage (track before error handling so we record failed calls too)
    // Use fire-and-forget to avoid blocking the API call
    this.trackApiCall(response, 'item_summary_search').catch((err) => {
      this.log.warn({ err }, 'Failed to track API usage (non-critical)');
    });

    if (!response.ok) {
      const errorText = await response.text();
      
      // Explicitly detect authentication errors
      if (response.status === 401 || response.status === 403) {
        throw new Error(
          `eBay API authentication failed (${response.status}): ${response.statusText}. ${errorText}. Please check your EBAY_APP_ID and EBAY_CLIENT_SECRET credentials.`
        );
      }
      
      throw new Error(
        `eBay API error: ${response.status} ${response.statusText}. ${errorText}`
      );
    }

    const data = (await response.json()) as EbayBrowseApiResponse;

    // Handle warnings if present
    if (data.warnings && data.warnings.length > 0) {
      this.log.warn({ warnings: data.warnings }, 'eBay API returned warnings');
    }

    return data;
  }

  async searchListings(
    keywords: string[],
    params?: EbaySearchParams
  ): Promise<Record<string, unknown>[]> {
    const keywordQuery = keywords.join(' ');

    // Configuration with defaults
    const limit = params?.entriesPerPage || 200; // Maximum per page
    const maxResults = params?.maxResults || 10000;
    const enablePagination = params?.enablePagination !== false; // Default: true
    const fieldgroups = params?.fieldgroups || 'EXTENDED';

    // Ensure we have a valid token before making requests
    const token = await this.ensureToken();
    const marketplaceId = params?.marketplaceId || this.defaultMarketplaceId;

    try {
      let allItems: Array<Record<string, unknown>> = [];
      let offset = 0;
      let total: number | null = null;
      let pageCount = 0;

      do {
        // Make API call for current page
        const response = await this.fetchPage(
          keywordQuery,
          limit,
          offset,
          fieldgroups,
          params,
          token,
          marketplaceId
        );

        const items = response.itemSummaries || [];
        pageCount++;

        // Log progress
        this.log.debug({ pageCount, itemsCount: items.length, offset, total: response.total ?? 'unknown' }, 'Fetched page');

        // Add items to collection
        allItems.push(
          ...items.map((item) => ({
            itemId: item.itemId,
            title: item.title,
            ...item,
          }))
        );

        // Update total from first response
        if (total === null) {
          total = response.total ?? 0;
        }

        // Check if we should continue pagination
        const hasMoreResults =
          enablePagination &&
          allItems.length < maxResults &&
          offset + limit < (total ?? 0) &&
          response.next;

        if (hasMoreResults) {
          offset += limit;
          // Add a small delay between requests to respect rate limits
          // eBay API typically allows reasonable request rates, but a small delay helps
          await new Promise((resolve) => setTimeout(resolve, 100));
        } else {
          break;
        }
      } while (true);

      // Limit results to maxResults
      const finalItems = allItems.slice(0, maxResults);

      this.log.debug({ itemsCollected: finalItems.length, pageCount }, 'Pagination complete');

      return finalItems;
    } catch (error) {
      this.log.error({ err: error }, 'Error fetching eBay listings');
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
      created_at: new Date().toISOString(),
      reconciled_at: null,
      reconciliation_version: null,
      updated_at: new Date().toISOString(),
      first_seen_at: new Date().toISOString(),
      last_seen_at: new Date().toISOString(),
      status: isActive ? 'active' : 'expired',
      job_id: null, // Will be set by capture service when inserting
      // Enrichment fields - will be populated by enrichment service
      enriched_at: null,
      enriched_raw_listing_id: null,
      additional_images: [],
      condition_description: null,
      category_path: null,
      item_location: null,
      estimated_availabilities: null,
      buying_options: [],
      // Sanitised fields - will be populated by sanitize service
      sanitised_title: null,
      sanitised_description: null,
      sanitised_at: null,
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
      // Ensure we have a valid token before making the request
      const token = await this.ensureToken();
      
      // eBay Browse API authentication - requires OAuth Bearer token
      const headers: HeadersInit = {
        Authorization: `Bearer ${token}`,
        'X-EBAY-C-MARKETPLACE-ID': this.defaultMarketplaceId,
        'Accept': 'application/json',
      };

      const response = await fetch(url, {
        headers,
      });

      // Track API usage (track before error handling so we record failed calls too)
      // Use fire-and-forget to avoid blocking the API call
      this.trackApiCall(response, 'get_item').catch((err) => {
        this.log.warn({ err }, 'Failed to track API usage (non-critical)');
      });

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error(`Item not found: ${itemId}`);
        }
        if (response.status === 429) {
          throw new Error('Rate limit exceeded. Please retry after delay.');
        }
        // Explicitly detect authentication errors
        if (response.status === 401 || response.status === 403) {
          const errorText = await response.text();
          throw new Error(
            `eBay API authentication failed (${response.status}): ${response.statusText}. ${errorText}. Please check your EBAY_APP_ID and EBAY_CLIENT_SECRET credentials.`
          );
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
        this.log.error({ err: error, itemId }, 'Error fetching eBay item details');
        throw error;
      }
      throw new Error(`Unknown error fetching item details for ${itemId}`);
    }
  }
}
