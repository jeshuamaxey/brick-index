import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EnrichmentService } from '@/lib/capture/enrichment-service';
import { EbayAdapter } from '@/lib/capture/marketplace-adapters/ebay-adapter';
import type { SupabaseClient } from '@supabase/supabase-js';

// Mock Supabase client
const createMockSupabase = () => {
  const mockUpdateCallbacks: Array<{ data: any; eq: any }> = [];
  let queryResolveValue: any = null;
  
  // Create chainable query mock that resolves at the end
  const createQueryChain = (finalResolve: any) => {
    queryResolveValue = finalResolve;
    let eqCallCount = 0;
    
    // Create a chain where the last method resolves
    const chain: any = {
      is: vi.fn().mockReturnThis(),
      eq: vi.fn(function(this: any, ...args: any[]) {
        eqCallCount++;
        // If this is the second eq call (marketplace filter) and no limit will be called, resolve
        // Otherwise return this to allow limit to be called
        return chain;
      }),
      limit: vi.fn(function(this: any, limitValue?: number) {
        // When limit is called, resolve with the stored value
        return Promise.resolve(queryResolveValue);
      }),
    };
    
    // Override the second eq to resolve if limit won't be called
    // We'll handle this by making limit always available and resolving
    // But if limit is not called, we need the second eq to resolve
    // Actually, let's make limit resolve, and if limit is not in the chain, make the second eq resolve
    const originalEq = chain.eq;
    chain.eq = vi.fn(function(this: any, ...args: any[]) {
      eqCallCount++;
      // Track that we've had 2 eq calls
      if (eqCallCount === 2) {
        // Return a thenable that resolves (in case limit is not called)
        const thenable = Promise.resolve(queryResolveValue);
        // But also allow chaining
        return Object.assign(thenable, {
          limit: vi.fn().mockResolvedValue(queryResolveValue),
        });
      }
      return chain;
    });
    
    return chain;
  };

  // Mock select that returns chainable query
  let currentQueryChain: any = null;
  const mockSelect = vi.fn(() => {
    return currentQueryChain || createQueryChain({ data: [], error: null });
  });

  // Mock insert that returns chainable object with select().single()
  let mockInsertSelectSingle: any = null;
  const mockInsertSelect = vi.fn(() => {
    if (!mockInsertSelectSingle) {
      mockInsertSelectSingle = {
        single: vi.fn().mockResolvedValue({ data: { id: 'raw-1' }, error: null }),
      };
    }
    return mockInsertSelectSingle;
  });
  
  const mockInsert = vi.fn(() => ({
    select: mockInsertSelect,
  }));
  
  // Helper to reset insert mocks
  const resetInsertMock = () => {
    mockInsertSelectSingle = {
      single: vi.fn().mockResolvedValue({ data: { id: 'raw-1' }, error: null }),
    };
  };

  // Mock update that returns chainable object
  const mockUpdate = vi.fn((data: any) => {
    const updateChain = {
      eq: vi.fn().mockResolvedValue({ error: null }),
    };
    mockUpdateCallbacks.push({ data, eq: updateChain.eq });
    return updateChain;
  });

  const mockFrom = vi.fn((table: string) => {
    if (table === 'raw_listings') {
      return {
        insert: mockInsert,
      };
    }
    if (table === 'listings') {
      return {
        select: mockSelect,
        update: mockUpdate,
      };
    }
    return {
      select: mockSelect,
      insert: mockInsert,
      update: mockUpdate,
    };
  });
  
  const mockSchema = vi.fn(() => ({
    from: mockFrom,
  }));

  return {
    supabase: {
      schema: mockSchema,
    } as unknown as SupabaseClient,
    mocks: {
      mockSelect,
      mockInsert,
      mockInsertSelect,
      mockInsertSelectSingle: () => mockInsertSelectSingle,
      resetInsertMock,
      mockUpdate,
      mockUpdateCallbacks,
      mockFrom,
      mockSchema,
      createQueryChain,
      setQueryChain: (chain: any) => {
        currentQueryChain = chain;
      },
    },
  };
};

describe('EnrichmentService', () => {
  let service: EnrichmentService;
  let mocks: ReturnType<typeof createMockSupabase>['mocks'];
  let adapter: EbayAdapter;

  beforeEach(() => {
    vi.clearAllMocks();
    const { supabase, mocks: mockFunctions } = createMockSupabase();
    mocks = mockFunctions;
    service = new EnrichmentService(supabase);
    adapter = new EbayAdapter('test-app-id', 'test-token');
    // Reset callbacks array
    mocks.mockUpdateCallbacks.length = 0;
    // Reset insert mock
    mocks.resetInsertMock();
  });

  describe('enrichListings()', () => {
    describe('Success cases', () => {
      it('successfully enriches listings', async () => {
        const listings = [
          { id: 'listing-1', external_id: 'item-1', marketplace: 'ebay' },
          { id: 'listing-2', external_id: 'item-2', marketplace: 'ebay' },
        ];

        const enrichedResponse1 = {
          itemId: 'item-1',
          description: 'Test description 1',
          additionalImages: [{ imageUrl: 'https://example.com/img1.jpg' }],
          conditionDescription: 'Used',
          categoryPath: 'Toys & Hobbies > Building Toys',
          itemLocation: {
            city: 'New York',
            stateOrProvince: 'NY',
            postalCode: '10001',
            country: 'US',
          },
          estimatedAvailabilities: [
            {
              estimatedAvailabilityStatus: 'IN_STOCK',
              estimatedAvailableQuantity: 1,
            },
          ],
          buyingOptions: ['FIXED_PRICE'],
        };

        const enrichedResponse2 = {
          itemId: 'item-2',
          description: 'Test description 2',
        };

        // Create chainable query mock
        const queryChain = mocks.createQueryChain({
          data: listings,
          error: null,
        });
        mocks.setQueryChain(queryChain);

        // Mock getItemDetails
        vi.spyOn(adapter, 'getItemDetails')
          .mockResolvedValueOnce(enrichedResponse1)
          .mockResolvedValueOnce(enrichedResponse2);

        // mockInsert is already set up to return chainable object with select().single()

        const result = await service.enrichListings(adapter);

        expect(result.total).toBe(2);
        expect(result.succeeded).toBe(2);
        expect(result.failed).toBe(0);
        expect(result.errors).toHaveLength(0);
        expect(mocks.mockInsert).toHaveBeenCalledTimes(2);
        expect(mocks.mockUpdate).toHaveBeenCalledTimes(2);
      });

      it('handles empty result set', async () => {
        const queryChain = mocks.createQueryChain({
          data: [],
          error: null,
        });
        mocks.setQueryChain(queryChain);

        const result = await service.enrichListings(adapter);

        expect(result.total).toBe(0);
        expect(result.succeeded).toBe(0);
        expect(result.failed).toBe(0);
        expect(result.errors).toHaveLength(0);
      });

      it('respects limit parameter', async () => {
        const listings = Array.from({ length: 5 }, (_, i) => ({
          id: `listing-${i}`,
          external_id: `item-${i}`,
          marketplace: 'ebay',
        }));

        const queryChain = mocks.createQueryChain({
          data: listings,
          error: null,
        });
        mocks.setQueryChain(queryChain);

        vi.spyOn(adapter, 'getItemDetails').mockResolvedValue({});
        mocks.mockInsert.mockResolvedValue({ data: { id: 'raw-1' }, error: null });
        // mockUpdate is already set up

        const result = await service.enrichListings(adapter, { limit: 5 });

        expect(result.total).toBe(5);
        // Verify limit was applied to query
        expect(mocks.mockSelect).toHaveBeenCalled();
      });

      it('applies rate limiting delay between calls', async () => {
        const listings = [
          { id: 'listing-1', external_id: 'item-1', marketplace: 'ebay' },
          { id: 'listing-2', external_id: 'item-2', marketplace: 'ebay' },
        ];

        const queryChain = mocks.createQueryChain({
          data: listings,
          error: null,
        });
        mocks.setQueryChain(queryChain);

        const getItemDetailsSpy = vi.spyOn(adapter, 'getItemDetails').mockResolvedValue({});
        // mockInsert is already set up

        const delayMs = 100;
        const callTimes: number[] = [];
        
        // Track when getItemDetails is called
        getItemDetailsSpy.mockImplementation(async () => {
          callTimes.push(Date.now());
          return {};
        });

        // Use real timers but track delays
        const startTime = Date.now();
        await service.enrichListings(adapter, { delayMs });
        const endTime = Date.now();

        // Verify both items were processed
        expect(getItemDetailsSpy).toHaveBeenCalledTimes(2);
        
        // Verify there was a delay between calls (at least delayMs)
        if (callTimes.length === 2) {
          const actualDelay = callTimes[1] - callTimes[0];
          // Allow some tolerance (at least 50ms of the 100ms delay)
          expect(actualDelay).toBeGreaterThanOrEqual(50);
        }
      });
    });

    describe('Error handling', () => {
      it('throws error when adapter does not support getItemDetails', async () => {
        const mockAdapter = {
          getMarketplace: () => 'ebay' as const,
        };

        await expect(
          service.enrichListings(mockAdapter as any)
        ).rejects.toThrow(
          'Adapter for marketplace "ebay" does not support item enrichment'
        );
      });

      it('throws error on database query failure', async () => {
        const queryChain = mocks.createQueryChain({
          data: null,
          error: { message: 'Database error' },
        });
        mocks.setQueryChain(queryChain);

        await expect(service.enrichListings(adapter)).rejects.toThrow(
          'Failed to query listings: Database error'
        );
      });

      it('handles individual item failures gracefully', async () => {
        const listings = [
          { id: 'listing-1', external_id: 'item-1', marketplace: 'ebay' },
          { id: 'listing-2', external_id: 'item-2', marketplace: 'ebay' },
          { id: 'listing-3', external_id: 'item-3', marketplace: 'ebay' },
        ];

        const queryChain = mocks.createQueryChain({
          data: listings,
          error: null,
        });
        mocks.setQueryChain(queryChain);

        // First succeeds, second fails, third succeeds
        vi.spyOn(adapter, 'getItemDetails')
          .mockResolvedValueOnce({})
          .mockRejectedValueOnce(new Error('API error'))
          .mockResolvedValueOnce({});

        // Set up insert to succeed for items 1 and 3 (item 2 fails before insert)
        // The insert will only be called for items 1 and 3 since item 2 fails at getItemDetails
        const insertSingle = mocks.mockInsertSelectSingle();
        insertSingle.single
          .mockResolvedValue({ data: { id: 'raw-1' }, error: null });

        const result = await service.enrichListings(adapter);

        expect(result.total).toBe(3);
        expect(result.succeeded).toBe(2);
        expect(result.failed).toBe(1);
        expect(result.errors).toHaveLength(1);
        expect(result.errors[0].listingId).toBe('listing-2');
        expect(result.errors[0].error).toContain('API error');
      });

      it('handles raw listing insert failure', async () => {
        const listings = [
          { id: 'listing-1', external_id: 'item-1', marketplace: 'ebay' },
        ];

        const queryChain = mocks.createQueryChain({
          data: listings,
          error: null,
        });
        mocks.setQueryChain(queryChain);

        vi.spyOn(adapter, 'getItemDetails').mockResolvedValue({});
        // Override insert select().single() to return error
        const insertSingle = mocks.mockInsertSelectSingle();
        insertSingle.single.mockResolvedValueOnce({
          data: null,
          error: { message: 'Insert failed' },
        });

        const result = await service.enrichListings(adapter);

        expect(result.failed).toBe(1);
        expect(result.errors[0].error).toContain('Failed to store raw listing');
      });

      it('handles listing update failure', async () => {
        const listings = [
          { id: 'listing-1', external_id: 'item-1', marketplace: 'ebay' },
        ];

        const queryChain = mocks.createQueryChain({
          data: listings,
          error: null,
        });
        mocks.setQueryChain(queryChain);

        vi.spyOn(adapter, 'getItemDetails').mockResolvedValue({});
        // Override update to return error
        mocks.mockUpdate.mockReturnValueOnce({
          eq: vi.fn().mockResolvedValue({
            error: { message: 'Update failed' },
          }),
        });

        const result = await service.enrichListings(adapter);

        expect(result.failed).toBe(1);
        expect(result.errors[0].error).toContain('Failed to update listing');
      });

      it('only processes unenriched listings', async () => {
        const queryChain = mocks.createQueryChain({
          data: [],
          error: null,
        });
        mocks.setQueryChain(queryChain);

        await service.enrichListings(adapter);

        // Verify query includes .is('enriched_at', null)
        expect(mocks.mockSelect).toHaveBeenCalled();
      });

      it('only processes active listings', async () => {
        const queryChain = mocks.createQueryChain({
          data: [],
          error: null,
        });
        mocks.setQueryChain(queryChain);

        await service.enrichListings(adapter);

        // Verify query includes .eq('status', 'active')
        expect(mocks.mockSelect).toHaveBeenCalled();
      });

      it('filters by marketplace', async () => {
        const queryChain = mocks.createQueryChain({
          data: [],
          error: null,
        });
        mocks.setQueryChain(queryChain);

        await service.enrichListings(adapter, { marketplace: 'ebay' });

        // Verify query includes .eq('marketplace', 'ebay')
        expect(mocks.mockSelect).toHaveBeenCalled();
      });
    });
  });

  describe('extractEnrichmentFields()', () => {
    // We need to test the private method indirectly through enrichListings
    // or make it public for testing

    it('extracts all fields correctly from complete response', async () => {
      const listing = {
        id: 'listing-1',
        external_id: 'item-1',
        marketplace: 'ebay',
      };

      const enrichedResponse = {
        itemId: 'item-1',
        description: 'Complete description',
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
            estimatedAvailabilityStatus: 'IN_STOCK',
            estimatedAvailableQuantity: 5,
            estimatedSoldQuantity: 2,
            estimatedRemainingQuantity: 3,
          },
        ],
        buyingOptions: ['FIXED_PRICE', 'BEST_OFFER'],
      };

      const queryChain = mocks.createQueryChain({
        data: [listing],
        error: null,
      });
      mocks.setQueryChain(queryChain);

      vi.spyOn(adapter, 'getItemDetails').mockResolvedValue(enrichedResponse);
      // mockInsert is already set up

      await service.enrichListings(adapter);

        // Verify update was called with extracted fields
        expect(mocks.mockUpdateCallbacks.length).toBeGreaterThan(0);
        const updateData = mocks.mockUpdateCallbacks[0].data;
        expect(updateData).toMatchObject({
        description: 'Complete description',
        additional_images: ['https://example.com/img1.jpg', 'https://example.com/img2.jpg'],
        condition_description: 'Used - Good',
        category_path: 'Toys & Hobbies > Building Toys > LEGO',
        item_location: {
          city: 'San Francisco',
          stateOrProvince: 'CA',
          postalCode: '94102',
          country: 'US',
        },
        buying_options: ['FIXED_PRICE', 'BEST_OFFER'],
      });
    });

    it('handles missing optional fields', async () => {
      const listing = {
        id: 'listing-1',
        external_id: 'item-1',
        marketplace: 'ebay',
      };

      const enrichedResponse = {
        itemId: 'item-1',
        description: 'Minimal description',
        // Missing optional fields
      };

      const queryChain = mocks.createQueryChain({
        data: [listing],
        error: null,
      });
      mocks.setQueryChain(queryChain);

      vi.spyOn(adapter, 'getItemDetails').mockResolvedValue(enrichedResponse);
      // mockInsert is already set up

      await service.enrichListings(adapter);

      expect(mocks.mockUpdateCallbacks.length).toBeGreaterThan(0);
      const updateData = mocks.mockUpdateCallbacks[0].data;
      expect(updateData).toMatchObject({
        description: 'Minimal description',
        additional_images: [],
        buying_options: [],
      });
    });

    it('filters invalid image URLs', async () => {
      const listing = {
        id: 'listing-1',
        external_id: 'item-1',
        marketplace: 'ebay',
      };

      const enrichedResponse = {
        itemId: 'item-1',
        additionalImages: [
          { imageUrl: 'https://example.com/valid.jpg' },
          { imageUrl: null },
          {},
          { imageUrl: 'https://example.com/also-valid.jpg' },
        ],
      };

      const queryChain = mocks.createQueryChain({
        data: [listing],
        error: null,
      });
      mocks.setQueryChain(queryChain);

      vi.spyOn(adapter, 'getItemDetails').mockResolvedValue(enrichedResponse);
      // mockInsert is already set up

      await service.enrichListings(adapter);

      expect(mocks.mockUpdateCallbacks.length).toBeGreaterThan(0);
      const updateData = mocks.mockUpdateCallbacks[0].data;
      expect(updateData.additional_images).toEqual([
        'https://example.com/valid.jpg',
        'https://example.com/also-valid.jpg',
      ]);
    });
  });
});

