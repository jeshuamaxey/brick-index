import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock Inngest client
const mockSend = vi.fn();
vi.mock('@/lib/inngest/client', () => ({
  inngest: {
    send: (...args: unknown[]) => mockSend(...args),
  },
}));

// Import route handler AFTER mocks are set up
import { POST } from '@/app/api/capture/enrich/route';

describe('POST /api/capture/enrich', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.EBAY_APP_ID = 'test-app-id';
    process.env.EBAY_OAUTH_APP_TOKEN = 'test-token';
  });

  it('successfully triggers enrichment and returns job immediately', async () => {
    mockSend.mockResolvedValue(undefined);

    const request = new NextRequest('http://localhost/api/capture/enrich', {
      method: 'POST',
      body: JSON.stringify({}),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toMatchObject({
      status: 'running',
      message: expect.stringContaining('Job started'),
    });
    expect(mockSend).toHaveBeenCalledWith({
      name: 'job/enrich.triggered',
      data: {
        marketplace: 'ebay',
        limit: undefined,
        delayMs: 200,
      },
    });
  });

  it('handles optional parameters', async () => {
    mockSend.mockResolvedValue(undefined);

    const request = new NextRequest('http://localhost/api/capture/enrich', {
      method: 'POST',
      body: JSON.stringify({
        marketplace: 'ebay',
        limit: 10,
        delayMs: 300,
      }),
    });

    await POST(request);

    expect(mockSend).toHaveBeenCalledWith({
      name: 'job/enrich.triggered',
      data: {
        marketplace: 'ebay',
        limit: 10,
        delayMs: 300,
      },
    });
  });

  it('uses default values when parameters not provided', async () => {
    mockSend.mockResolvedValue(undefined);

    const request = new NextRequest('http://localhost/api/capture/enrich', {
      method: 'POST',
      body: JSON.stringify({}),
    });

    await POST(request);

    expect(mockSend).toHaveBeenCalledWith({
      name: 'job/enrich.triggered',
      data: {
        marketplace: 'ebay',
        limit: undefined,
        delayMs: 200,
      },
    });
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
    expect(mockSend).not.toHaveBeenCalled();
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
    expect(mockSend).not.toHaveBeenCalled();
  });

  it('handles enrichment service errors during job creation', async () => {
    const errorMessage = 'Inngest send failed';
    // Mock Inngest send to fail
    mockSend.mockRejectedValue(new Error(errorMessage));

    const request = new NextRequest('http://localhost/api/capture/enrich', {
      method: 'POST',
      body: JSON.stringify({}),
    });

    const response = await POST(request);
    const data = await response.json();

    // Errors during Inngest event sending are caught
    expect(response.status).toBe(500);
    expect(data.error).toBe(errorMessage);
  });

  it('handles unknown errors during job creation', async () => {
    // Mock to reject immediately with non-Error value
    mockSend.mockRejectedValue('Unknown error');

    const request = new NextRequest('http://localhost/api/capture/enrich', {
      method: 'POST',
      body: JSON.stringify({}),
    });

    const response = await POST(request);
    const data = await response.json();

    // Errors during Inngest event sending are caught
    expect(response.status).toBe(500);
    expect(data.error).toBe('Unknown error occurred');
  });

  it('handles empty body gracefully', async () => {
    mockSend.mockResolvedValue(undefined);

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
    expect(data).toMatchObject({
      status: 'running',
      message: expect.stringContaining('Job started'),
    });
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

