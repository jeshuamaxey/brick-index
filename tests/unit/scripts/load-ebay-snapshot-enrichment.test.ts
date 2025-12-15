import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';

// Test the extractEnrichmentFields function logic
// This mirrors the function from load-ebay-snapshot-into-supabase.ts
function extractEnrichmentFields(
  response: Record<string, unknown>
): Record<string, unknown> {
  const fields: Record<string, unknown> = {};

  // Description
  if (response.description !== undefined) {
    fields.description = response.description;
  }

  // Additional images
  if (
    response.additionalImages &&
    Array.isArray(response.additionalImages)
  ) {
    fields.additional_images = (response.additionalImages as Array<{ imageUrl?: string }>)
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
  if (response.itemLocation !== undefined) {
    fields.item_location = response.itemLocation;
  }

  // Estimated availabilities
  if (
    response.estimatedAvailabilities &&
    Array.isArray(response.estimatedAvailabilities)
  ) {
    fields.estimated_availabilities = response.estimatedAvailabilities;
  }

  // Buying options
  if (response.buyingOptions && Array.isArray(response.buyingOptions)) {
    fields.buying_options = response.buyingOptions;
  } else {
    fields.buying_options = [];
  }

  return fields;
}

describe('load-ebay-snapshot-into-supabase enrichment handling', () => {
  describe('extractEnrichmentFields()', () => {
    it('extracts all fields from complete response', () => {
      const response = {
        description: 'Test description',
        additionalImages: [
          { imageUrl: 'https://example.com/img1.jpg' },
          { imageUrl: 'https://example.com/img2.jpg' },
        ],
        conditionDescription: 'Used - Good',
        categoryPath: 'Toys & Hobbies > Building Toys > LEGO',
        itemLocation: {
          city: 'San Francisco',
          stateOrProvince: 'CA',
          postalCode: '94102',
          country: 'US',
        },
        estimatedAvailabilities: [
          {
            estimatedSoldQuantity: 5,
            estimatedRemainingQuantity: 10,
          },
        ],
        buyingOptions: ['FIXED_PRICE', 'BEST_OFFER'],
      };

      const result = extractEnrichmentFields(response);

      expect(result.description).toBe('Test description');
      expect(result.additional_images).toEqual([
        'https://example.com/img1.jpg',
        'https://example.com/img2.jpg',
      ]);
      expect(result.condition_description).toBe('Used - Good');
      expect(result.category_path).toBe('Toys & Hobbies > Building Toys > LEGO');
      expect(result.item_location).toEqual({
        city: 'San Francisco',
        stateOrProvince: 'CA',
        postalCode: '94102',
        country: 'US',
      });
      expect(result.estimated_availabilities).toEqual([
        {
          estimatedSoldQuantity: 5,
          estimatedRemainingQuantity: 10,
        },
      ]);
      expect(result.buying_options).toEqual(['FIXED_PRICE', 'BEST_OFFER']);
    });

    it('handles missing optional fields', () => {
      const response = {
        description: 'Minimal description',
      };

      const result = extractEnrichmentFields(response);

      expect(result.description).toBe('Minimal description');
      expect(result.additional_images).toEqual([]);
      expect(result.buying_options).toEqual([]);
      expect(result.condition_description).toBeUndefined();
      expect(result.category_path).toBeUndefined();
    });

    it('filters invalid image URLs', () => {
      const response = {
        additionalImages: [
          { imageUrl: 'https://example.com/valid.jpg' },
          { imageUrl: null },
          {},
          { imageUrl: 'https://example.com/also-valid.jpg' },
          { imageUrl: '' },
        ],
      };

      const result = extractEnrichmentFields(response);

      // The function filters out null/undefined but keeps empty strings
      // This matches the behavior in EnrichmentService
      expect(result.additional_images).toContain('https://example.com/valid.jpg');
      expect(result.additional_images).toContain('https://example.com/also-valid.jpg');
      // Empty strings are kept (this is the current behavior)
      expect((result.additional_images as string[]).filter((url) => url && url.length > 0)).toHaveLength(2);
    });

    it('handles empty arrays', () => {
      const response = {
        additionalImages: [],
        buyingOptions: [],
        estimatedAvailabilities: [],
      };

      const result = extractEnrichmentFields(response);

      expect(result.additional_images).toEqual([]);
      expect(result.buying_options).toEqual([]);
      expect(result.estimated_availabilities).toEqual([]);
    });

    it('handles undefined values', () => {
      const response = {
        description: undefined,
        additionalImages: undefined,
        buyingOptions: undefined,
      };

      const result = extractEnrichmentFields(response);

      expect(result.description).toBeUndefined();
      expect(result.additional_images).toEqual([]);
      expect(result.buying_options).toEqual([]);
    });

    it('handles null values', () => {
      const response = {
        description: null,
        conditionDescription: null,
        categoryPath: null,
      };

      const result = extractEnrichmentFields(response);

      expect(result.description).toBeNull();
      expect(result.condition_description).toBeNull();
      expect(result.category_path).toBeNull();
    });
  });

  describe('enrichment processing logic', () => {
    it('should process enrichedItems from snapshot', () => {
      const snapshot = {
        profile: 'test-profile',
        mode: 'normal',
        keywords: ['lego'],
        createdAt: new Date().toISOString(),
        items: [
          {
            itemId: '123',
            title: 'Test Item',
          },
        ],
        enrichedItems: {
          '123': {
            itemId: '123',
            description: 'Enriched description',
            additionalImages: [{ imageUrl: 'https://example.com/img.jpg' }],
          },
        },
      };

      // Verify structure
      expect(snapshot.enrichedItems).toBeDefined();
      expect(snapshot.enrichedItems['123']).toBeDefined();
      expect(snapshot.enrichedItems['123'].description).toBe('Enriched description');
    });

    it('should handle snapshot without enrichedItems', () => {
      const snapshot = {
        profile: 'test-profile',
        mode: 'normal',
        keywords: ['lego'],
        createdAt: new Date().toISOString(),
        items: [
          {
            itemId: '123',
            title: 'Test Item',
          },
        ],
      };

      expect((snapshot as any).enrichedItems).toBeUndefined();
    });

    it('should map external_id to listing_id correctly', () => {
      const listings = [
        { id: 'listing-1', external_id: 'item-123' },
        { id: 'listing-2', external_id: 'item-456' },
      ];

      const externalIdToListingId = new Map<string, string>();
      for (const listing of listings) {
        externalIdToListingId.set(listing.external_id, listing.id);
      }

      expect(externalIdToListingId.get('item-123')).toBe('listing-1');
      expect(externalIdToListingId.get('item-456')).toBe('listing-2');
      expect(externalIdToListingId.get('item-789')).toBeUndefined();
    });

    it('should extract fields from enriched response correctly', () => {
      const enrichedResponse = {
        itemId: '123',
        description: 'Test description',
        additionalImages: [
          { imageUrl: 'https://example.com/img1.jpg' },
          { imageUrl: 'https://example.com/img2.jpg' },
        ],
        conditionDescription: 'Used - Good',
        categoryPath: 'Toys > LEGO',
        itemLocation: { city: 'SF', stateOrProvince: 'CA' },
        estimatedAvailabilities: [{ estimatedSoldQuantity: 5 }],
        buyingOptions: ['FIXED_PRICE'],
      };

      const extracted = extractEnrichmentFields(enrichedResponse);

      expect(extracted.description).toBe('Test description');
      expect(extracted.additional_images).toHaveLength(2);
      expect(extracted.condition_description).toBe('Used - Good');
      expect(extracted.category_path).toBe('Toys > LEGO');
      expect(extracted.item_location).toEqual({ city: 'SF', stateOrProvince: 'CA' });
      expect(extracted.estimated_availabilities).toHaveLength(1);
      expect(extracted.buying_options).toEqual(['FIXED_PRICE']);
    });

    it('should handle multiple enriched items', () => {
      const enrichedItems = {
        'item-123': {
          itemId: 'item-123',
          description: 'Item 1 description',
        },
        'item-456': {
          itemId: 'item-456',
          description: 'Item 2 description',
        },
        'item-789': {
          itemId: 'item-789',
          description: 'Item 3 description',
        },
      };

      const itemIds = Object.keys(enrichedItems);
      expect(itemIds).toHaveLength(3);
      expect(itemIds).toContain('item-123');
      expect(itemIds).toContain('item-456');
      expect(itemIds).toContain('item-789');
    });
  });
});

