// Mock marketplace adapter for testing without API access

import type { Marketplace, Listing } from '@/lib/types';
import type { MarketplaceAdapter } from './base-adapter';

/**
 * Mock adapter that returns sample LEGO listing data
 * Use this when you don't have eBay API access yet
 */
export class MockAdapter implements MarketplaceAdapter {
  getMarketplace(): Marketplace {
    return 'ebay';
  }

  async searchListings(keywords: string[]): Promise<Record<string, unknown>[]> {
    // Return mock eBay API responses
    // These simulate real eBay Finding API responses
    return [
      {
        itemId: ['123456789'],
        title: ['Large LEGO Bulk Lot - 2000+ Pieces, 10 Minifigs, Used'],
        globalId: ['EBAY-US'],
        galleryURL: ['https://example.com/image1.jpg'],
        viewItemURL: ['https://www.ebay.com/itm/123456789'],
        location: ['New York, NY'],
        country: ['US'],
        sellingStatus: [
          {
            currentPrice: [
              {
                '@currencyId': 'USD',
                __value__: '150.00',
              },
            ],
          },
        ],
        sellerInfo: [
          {
            sellerUserName: ['legoseller123'],
            feedbackScore: ['500'],
            positiveFeedbackPercent: ['99.5'],
          },
        ],
        condition: [
          {
            conditionId: ['3000'],
            conditionDisplayName: ['Used'],
          },
        ],
      },
      {
        itemId: ['987654321'],
        title: ['LEGO Job Lot - Approximately 1500 Pieces, 5 Minifigs'],
        globalId: ['EBAY-US'],
        galleryURL: ['https://example.com/image2.jpg'],
        viewItemURL: ['https://www.ebay.com/itm/987654321'],
        location: ['Los Angeles, CA'],
        country: ['US'],
        sellingStatus: [
          {
            currentPrice: [
              {
                '@currencyId': 'USD',
                __value__: '75.00',
              },
            ],
          },
        ],
        sellerInfo: [
          {
            sellerUserName: ['brickcollector'],
            feedbackScore: ['1200'],
            positiveFeedbackPercent: ['100.0'],
          },
        ],
        condition: [
          {
            conditionId: ['3000'],
            conditionDisplayName: ['Used'],
          },
        ],
      },
      {
        itemId: ['555666777'],
        title: ['Huge LEGO Collection - 5000 Pieces, 25 Minifigs, Mixed Condition'],
        globalId: ['EBAY-US'],
        galleryURL: ['https://example.com/image3.jpg'],
        viewItemURL: ['https://www.ebay.com/itm/555666777'],
        location: ['Chicago, IL'],
        country: ['US'],
        sellingStatus: [
          {
            currentPrice: [
              {
                '@currencyId': 'USD',
                __value__: '300.00',
              },
            ],
          },
        ],
        sellerInfo: [
          {
            sellerUserName: ['megabricks'],
            feedbackScore: ['2500'],
            positiveFeedbackPercent: ['98.8'],
          },
        ],
        condition: [
          {
            conditionId: ['3000'],
            conditionDisplayName: ['Used'],
          },
        ],
      },
      {
        itemId: ['111222333'],
        title: ['LEGO Bulk Lot - 800 Pieces, No Minifigs Mentioned'],
        globalId: ['EBAY-US'],
        galleryURL: ['https://example.com/image4.jpg'],
        viewItemURL: ['https://www.ebay.com/itm/111222333'],
        location: ['Miami, FL'],
        country: ['US'],
        sellingStatus: [
          {
            currentPrice: [
              {
                '@currencyId': 'USD',
                __value__: '45.00',
              },
            ],
          },
        ],
        sellerInfo: [
          {
            sellerUserName: ['brickdeals'],
            feedbackScore: ['800'],
            positiveFeedbackPercent: ['97.2'],
          },
        ],
        condition: [
          {
            conditionId: ['3000'],
            conditionDisplayName: ['Used'],
          },
        ],
      },
      {
        itemId: ['444555666'],
        title: ['Brand New LEGO Sets - Sealed Boxes, 3000 Pieces Total'],
        globalId: ['EBAY-US'],
        galleryURL: ['https://example.com/image5.jpg'],
        viewItemURL: ['https://www.ebay.com/itm/444555666'],
        location: ['Seattle, WA'],
        country: ['US'],
        sellingStatus: [
          {
            currentPrice: [
              {
                '@currencyId': 'USD',
                __value__: '250.00',
              },
            ],
          },
        ],
        sellerInfo: [
          {
            sellerUserName: ['newlegos'],
            feedbackScore: ['300'],
            positiveFeedbackPercent: ['100.0'],
          },
        ],
        condition: [
          {
            conditionId: ['1000'],
            conditionDisplayName: ['New'],
          },
        ],
      },
    ];
  }

  transformToListing(
    rawResponse: Record<string, unknown>,
    rawListingId: string
  ): Listing {
    const item = rawResponse as any;

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
      'USD';

    return {
      id: '', // Will be generated by database
      raw_listing_id: rawListingId,
      marketplace: 'ebay',
      external_id: itemId,
      title,
      description: null,
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
      // Enrichment fields (not enriched by default in mock adapter)
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
    return true;
  }
}

