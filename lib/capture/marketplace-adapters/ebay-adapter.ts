// eBay Finding API adapter

import type { Marketplace, Listing } from '@/lib/types';
import type { MarketplaceAdapter } from './base-adapter';

interface EbayFindingApiResponse {
  findItemsByKeywordsResponse?: Array<{
    searchResult?: Array<{
      item?: Array<{
        itemId?: string[];
        title?: string[];
        globalId?: string[];
        primaryCategory?: Array<{
          categoryId?: string[];
          categoryName?: string[];
        }>;
        galleryURL?: string[];
        viewItemURL?: string[];
        location?: string[];
        country?: string[];
        shippingInfo?: Array<{
          shippingServiceCost?: Array<{
            '@currencyId'?: string;
            __value__?: string;
          }>;
        }>;
        sellingStatus?: Array<{
          currentPrice?: Array<{
            '@currencyId'?: string;
            __value__?: string;
          }>;
          convertedCurrentPrice?: Array<{
            '@currencyId'?: string;
            __value__?: string;
          }>;
        }>;
        listingInfo?: Array<{
          listingType?: string[];
          gift?: string[];
          watchCount?: string[];
        }>;
        condition?: Array<{
          conditionId?: string[];
          conditionDisplayName?: string[];
        }>;
        sellerInfo?: Array<{
          sellerUserName?: string[];
          feedbackScore?: string[];
          positiveFeedbackPercent?: string[];
        }>;
        description?: string[];
      }>;
    }>;
  }>;
}

interface EbayItem {
  itemId?: string[];
  title?: string[];
  globalId?: string[];
  primaryCategory?: Array<{
    categoryId?: string[];
    categoryName?: string[];
  }>;
  galleryURL?: string[];
  viewItemURL?: string[];
  location?: string[];
  country?: string[];
  shippingInfo?: Array<{
    shippingServiceCost?: Array<{
      '@currencyId'?: string;
      __value__?: string;
    }>;
  }>;
  sellingStatus?: Array<{
    currentPrice?: Array<{
      '@currencyId'?: string;
      __value__?: string;
    }>;
    convertedCurrentPrice?: Array<{
      '@currencyId'?: string;
      __value__?: string;
    }>;
  }>;
  listingInfo?: Array<{
    listingType?: string[];
    gift?: string[];
    watchCount?: string[];
  }>;
  condition?: Array<{
    conditionId?: string[];
    conditionDisplayName?: string[];
  }>;
  sellerInfo?: Array<{
    sellerUserName?: string[];
    feedbackScore?: string[];
    positiveFeedbackPercent?: string[];
  }>;
  description?: string[];
}

export interface EbaySearchParams {
  entriesPerPage?: number;
  listingTypes?: string[]; // e.g., ['AuctionWithBIN', 'FixedPrice']
  hideDuplicateItems?: boolean;
  categoryId?: string;
}

export class EbayAdapter implements MarketplaceAdapter {
  private appId: string;
  private baseUrl: string;

  constructor(appId: string) {
    if (!appId) {
      throw new Error('eBay App ID is required');
    }
    this.appId = appId;

    // Support both production and sandbox/staging environments.
    // If you're using an eBay *sandbox* App ID, set EBAY_ENVIRONMENT=sandbox
    // so we hit the correct endpoint instead of production.
    const environment = process.env.EBAY_ENVIRONMENT ?? 'production';
    this.baseUrl =
      environment === 'sandbox'
        ? 'https://svcs.sandbox.ebay.com/services/search/FindingService/v1'
        : 'https://svcs.ebay.com/services/search/FindingService/v1';
  }

  getMarketplace(): Marketplace {
    return 'ebay';
  }

  async searchListings(
    keywords: string[],
    params?: EbaySearchParams
  ): Promise<Record<string, unknown>[]> {
    const keywordQuery = keywords.join(' ');
    const url = new URL(this.baseUrl);
    url.searchParams.set('OPERATION-NAME', 'findItemsByKeywords');
    url.searchParams.set('SERVICE-VERSION', '1.0.0');
    url.searchParams.set('SECURITY-APPNAME', this.appId);
    url.searchParams.set('RESPONSE-DATA-FORMAT', 'JSON');
    url.searchParams.set('REST-PAYLOAD', '');
    url.searchParams.set('keywords', keywordQuery);

    // Apply optional parameters
    let filterIndex = 0;

    // Entries per page
    if (params?.entriesPerPage !== undefined) {
      url.searchParams.set(
        'paginationInput.entriesPerPage',
        params.entriesPerPage.toString()
      );
    }

    // Listing types filter
    if (params?.listingTypes && params.listingTypes.length > 0) {
      url.searchParams.set(`itemFilter(${filterIndex}).name`, 'ListingType');
      params.listingTypes.forEach((type, idx) => {
        url.searchParams.set(
          `itemFilter(${filterIndex}).value(${idx})`,
          type
        );
      });
      filterIndex++;
    }

    // Hide duplicate items filter
    if (params?.hideDuplicateItems !== undefined) {
      url.searchParams.set(
        `itemFilter(${filterIndex}).name`,
        'HideDuplicateItems'
      );
      url.searchParams.set(
        `itemFilter(${filterIndex}).value`,
        params.hideDuplicateItems.toString()
      );
      filterIndex++;
    }

    // Category ID
    if (params?.categoryId !== undefined) {
      url.searchParams.set('categoryId', params.categoryId);
    }

    try {
      const response = await fetch(url.toString());
      if (!response.ok) {
        throw new Error(`eBay API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      const items = this.extractItemsFromResponse(data);

      // Return raw API responses for storage in raw_listings
      return items.map((item) => ({
        itemId: item.itemId?.[0],
        title: item.title?.[0],
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
    const item = rawResponse as unknown as EbayItem;

    const itemId = item.itemId?.[0] || '';
    const title = item.title?.[0] || '';
    const viewItemURL = item.viewItemURL?.[0] || '';
    const galleryURL = item.galleryURL?.[0] || '';
    const location = item.location?.[0] || null;
    const sellerUserName = item.sellerInfo?.[0]?.sellerUserName?.[0] || null;
    const feedbackScore = item.sellerInfo?.[0]?.feedbackScore?.[0];
    const sellerRating = feedbackScore ? parseFloat(feedbackScore) : null;

    // Extract price
    const currentPrice =
      item.sellingStatus?.[0]?.currentPrice?.[0]?.__value__ ||
      item.sellingStatus?.[0]?.convertedCurrentPrice?.[0]?.__value__;
    const price = currentPrice ? parseFloat(currentPrice) : null;
    const currency =
      item.sellingStatus?.[0]?.currentPrice?.[0]?.['@currencyId'] ||
      item.sellingStatus?.[0]?.convertedCurrentPrice?.[0]?.['@currencyId'] ||
      null;

    // Extract description (may not be in basic response, would need GetSingleItem call)
    const description = item.description?.[0] || null;

    return {
      id: '', // Will be generated by database
      raw_listing_id: rawListingId,
      marketplace: 'ebay',
      external_id: itemId,
      title,
      description,
      price,
      currency,
      url: viewItemURL,
      image_urls: galleryURL ? [galleryURL] : [],
      location,
      seller_name: sellerUserName,
      seller_rating: sellerRating,
      created_at: new Date(),
      updated_at: new Date(),
      first_seen_at: new Date(),
      last_seen_at: new Date(),
      status: 'active',
    };
  }

  async isListingActive(_externalId: string): Promise<boolean> {
    // For now, we'll assume listings are active if they exist
    // In a full implementation, we'd call GetSingleItem to check status
    // This is a placeholder
    return true;
  }

  private extractItemsFromResponse(
    data: EbayFindingApiResponse
  ): EbayItem[] {
    const items: EbayItem[] = [];

    const response =
      data.findItemsByKeywordsResponse?.[0]?.searchResult?.[0]?.item;

    if (response && Array.isArray(response)) {
      for (const item of response) {
        if (item) {
          items.push(item);
        }
      }
    }

    return items;
  }
}

