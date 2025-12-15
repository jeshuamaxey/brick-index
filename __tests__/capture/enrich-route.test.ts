import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock EnrichmentService
const mockEnrichListings = vi.fn();
vi.mock('@/lib/capture/enrichment-service', () => ({
  EnrichmentService: class {
    enrichListings = mockEnrichListings;
  },
}));

// Mock EbayAdapter - return a proper constructor
vi.mock('@/lib/capture/marketplace-adapters/ebay-adapter', () => ({
  EbayAdapter: vi.fn().mockImplementation(function (appId: string, token?: string) {
    this.getMarketplace = () => 'ebay' as const;
    this.getItemDetails = vi.fn();
    return this;
  }),
}));

// Mock Supabase client
vi.mock('@/lib/supabase/client', () => ({
  supabase: {},
}));

// Import route handler AFTER mocks are set up
import { POST } from '@/app/api/capture/enrich/route';

describe('POST /api/capture/enrich', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.EBAY_APP_ID = 'test-app-id';
    process.env.EBAY_OAUTH_APP_TOKEN = 'test-token';
  });

  it('successfully triggers enrichment', async () => {
    const mockResult = {
      total: 5,
      succeeded: 5,
      failed: 0,
      errors: [],
    };

    mockEnrichListings.mockResolvedValue(mockResult);

    const request = new NextRequest('http://localhost/api/capture/enrich', {
      method: 'POST',
      body: JSON.stringify({}),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual(mockResult);
    expect(mockEnrichListings).toHaveBeenCalledTimes(1);
  });

  it('handles optional parameters', async () => {
    const mockResult = {
      total: 10,
      succeeded: 10,
      failed: 0,
      errors: [],
    };

    mockEnrichListings.mockResolvedValue(mockResult);

    const request = new NextRequest('http://localhost/api/capture/enrich', {
      method: 'POST',
      body: JSON.stringify({
        marketplace: 'ebay',
        limit: 10,
        delayMs: 300,
      }),
    });

    await POST(request);

    expect(mockEnrichListings).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        marketplace: 'ebay',
        limit: 10,
        delayMs: 300,
      })
    );
  });

  it('uses default values when parameters not provided', async () => {
    mockEnrichListings.mockResolvedValue({
      total: 0,
      succeeded: 0,
      failed: 0,
      errors: [],
    });

    const request = new NextRequest('http://localhost/api/capture/enrich', {
      method: 'POST',
      body: JSON.stringify({}),
    });

    await POST(request);

    expect(mockEnrichListings).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        marketplace: 'ebay',
        delayMs: 200,
      })
    );
  });

  it('returns 400 when EBAY_APP_ID is missing', async () => {
    delete process.env.EBAY_APP_ID;

    const request = new NextRequest('http://localhost/api/capture/enrich', {
      method: 'POST',
      body: JSON.stringify({}),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain('EBAY_APP_ID');
    expect(mockEnrichListings).not.toHaveBeenCalled();
  });

  it('returns 400 for unsupported marketplace', async () => {
    const request = new NextRequest('http://localhost/api/capture/enrich', {
      method: 'POST',
      body: JSON.stringify({
        marketplace: 'unsupported',
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain('Unsupported marketplace');
    expect(mockEnrichListings).not.toHaveBeenCalled();
  });

  it('handles enrichment service errors', async () => {
    const errorMessage = 'Enrichment failed';
    mockEnrichListings.mockRejectedValue(new Error(errorMessage));

    const request = new NextRequest('http://localhost/api/capture/enrich', {
      method: 'POST',
      body: JSON.stringify({}),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe(errorMessage);
  });

  it('handles unknown errors', async () => {
    mockEnrichListings.mockRejectedValue('Unknown error');

    const request = new NextRequest('http://localhost/api/capture/enrich', {
      method: 'POST',
      body: JSON.stringify({}),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe('Unknown error occurred');
  });

  it('handles empty body gracefully', async () => {
    mockEnrichListings.mockResolvedValue({
      total: 0,
      succeeded: 0,
      failed: 0,
      errors: [],
    });

    // Create request with empty JSON object (valid but empty)
    const request = new NextRequest('http://localhost/api/capture/enrich', {
      method: 'POST',
      body: JSON.stringify({}),
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Empty body should be handled
    const response = await POST(request);
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.total).toBe(0);
  });

  it('handles invalid JSON body gracefully', async () => {
    const request = new NextRequest('http://localhost/api/capture/enrich', {
      method: 'POST',
      body: 'invalid json',
    });

    // The route should handle JSON parsing errors
    // This test verifies the route doesn't crash on invalid JSON
    await expect(POST(request)).resolves.toBeDefined();
  });
});

