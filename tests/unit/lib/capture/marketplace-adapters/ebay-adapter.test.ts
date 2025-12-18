import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EbayAdapter } from '@/lib/capture/marketplace-adapters/ebay-adapter';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('EbayAdapter.getItemDetails()', () => {
  const appId = 'test-app-id';
  const oauthToken = 'test-oauth-token';
  let adapter: EbayAdapter;

  beforeEach(() => {
    vi.clearAllMocks();
    // Set environment to production for consistent testing
    process.env.EBAY_ENVIRONMENT = 'PRODUCTION';
    process.env.EBAY_MARKETPLACE_ID = 'EBAY_US';
    adapter = new EbayAdapter(appId, oauthToken);
  });

  describe('Success cases', () => {
    it('successfully fetches item details with legacy item ID', async () => {
      const itemId = '123456789';
      const mockResponse = {
        itemId: '123456789',
        title: 'Test Item',
        description: 'Test description',
        price: { value: '100.00', currency: 'USD' },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await adapter.getItemDetails(itemId);

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toContain('/item/123456789');
      expect(options.headers).toMatchObject({
        Authorization: `Bearer ${oauthToken}`,
        'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US',
        Accept: 'application/json',
      });
      expect(result).toEqual(mockResponse);
    });

    it('successfully fetches item details with RESTful item ID format', async () => {
      const itemId = 'v1|123456789|0';
      const mockResponse = {
        itemId: 'v1|123456789|0',
        title: 'Test Item',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await adapter.getItemDetails(itemId);

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [url] = mockFetch.mock.calls[0];
      // Verify URL encoding
      expect(url).toContain('/item/v1%7C123456789%7C0');
      expect(result).toEqual(mockResponse);
    });

    it('uses correct base URL for production', async () => {
      process.env.EBAY_ENVIRONMENT = 'PRODUCTION';
      const adapter = new EbayAdapter(appId, oauthToken);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      });

      await adapter.getItemDetails('123');

      const [url] = mockFetch.mock.calls[0];
      expect(url).toContain('api.ebay.com');
      expect(url).not.toContain('sandbox');
    });

    it('uses correct base URL for sandbox', async () => {
      process.env.EBAY_ENVIRONMENT = 'SANDBOX';
      const adapter = new EbayAdapter(appId, oauthToken);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      });

      await adapter.getItemDetails('123');

      const [url] = mockFetch.mock.calls[0];
      expect(url).toContain('api.sandbox.ebay.com');
    });

    it('uses custom marketplace ID from environment', async () => {
      process.env.EBAY_MARKETPLACE_ID = 'EBAY_GB';
      const adapter = new EbayAdapter(appId, oauthToken);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      });

      await adapter.getItemDetails('123');

      const [, options] = mockFetch.mock.calls[0];
      expect(options.headers['X-EBAY-C-MARKETPLACE-ID']).toBe('EBAY_GB');
    });
  });

  describe('Error handling', () => {
    it('throws error when itemId is empty', async () => {
      await expect(adapter.getItemDetails('')).rejects.toThrow(
        'Item ID is required'
      );
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('throws error when itemId is missing', async () => {
      // @ts-expect-error - Testing invalid input
      await expect(adapter.getItemDetails(null)).rejects.toThrow();
    });

    it('handles 404 Not Found error', async () => {
      const itemId = '999999999';
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        text: async () => 'Item not found',
      });

      await expect(adapter.getItemDetails(itemId)).rejects.toThrow(
        'Item not found: 999999999'
      );
    });

    it('handles 429 Rate Limit error', async () => {
      const itemId = '123456789';
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        statusText: 'Too Many Requests',
        text: async () => 'Rate limit exceeded',
      });

      await expect(adapter.getItemDetails(itemId)).rejects.toThrow(
        'Rate limit exceeded. Please retry after delay.'
      );
    });

    it('handles other HTTP errors with error text', async () => {
      const itemId = '123456789';
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        text: async () => 'Server error details',
      });

      await expect(adapter.getItemDetails(itemId)).rejects.toThrow(
        'eBay Browse API error: 500 Internal Server Error. Server error details'
      );
    });

    it('handles network errors', async () => {
      const itemId = '123456789';
      const networkError = new Error('Network request failed');
      mockFetch.mockRejectedValueOnce(networkError);

      await expect(adapter.getItemDetails(itemId)).rejects.toThrow(
        'Network request failed'
      );
    });

    it('handles JSON parsing errors', async () => {
      const itemId = '123456789';
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => {
          throw new Error('Invalid JSON');
        },
      });

      await expect(adapter.getItemDetails(itemId)).rejects.toThrow();
    });

    it('handles unknown errors gracefully', async () => {
      const itemId = '123456789';
      mockFetch.mockRejectedValueOnce('Unknown error');

      await expect(adapter.getItemDetails(itemId)).rejects.toThrow(
        `Unknown error fetching item details for ${itemId}`
      );
    });
  });

  describe('URL encoding', () => {
    it('properly encodes special characters in item ID', async () => {
      const itemId = 'v1|123|456|789';
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      });

      await adapter.getItemDetails(itemId);

      const [url] = mockFetch.mock.calls[0];
      // Pipe character should be encoded as %7C
      expect(url).toContain('v1%7C123%7C456%7C789');
      expect(url).not.toContain('v1|123|456|789');
    });

    it('handles item IDs with spaces', async () => {
      const itemId = 'item with spaces';
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      });

      await adapter.getItemDetails(itemId);

      const [url] = mockFetch.mock.calls[0];
      expect(url).toContain(encodeURIComponent(itemId));
    });
  });

  describe('browseBaseUrl initialization', () => {
    it('initializes browseBaseUrl correctly in constructor', async () => {
      process.env.EBAY_ENVIRONMENT = 'PRODUCTION';
      const adapter = new EbayAdapter(appId, oauthToken);
      
      // Verify browseBaseUrl is set by checking it's used in getItemDetails
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      });

      await adapter.getItemDetails('123');

      const [url] = mockFetch.mock.calls[0];
      expect(url).toContain('api.ebay.com/buy/browse/v1/item');
    });
  });
});

