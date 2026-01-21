import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock next/headers cookies
const mockCookieStore = {
  getAll: vi.fn(() => []),
};
vi.mock('next/headers', () => ({
  cookies: vi.fn(() => Promise.resolve(mockCookieStore)),
}));

// Mock Supabase SSR client
const mockAuthGetUser = vi.fn();
const mockSelectFromDatasets = vi.fn();
const mockSupabaseSSRClient = {
  auth: {
    getUser: mockAuthGetUser,
  },
  schema: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: mockSelectFromDatasets,
          })),
        })),
      })),
    })),
  })),
};
vi.mock('@supabase/ssr', () => ({
  createServerClient: vi.fn(() => mockSupabaseSSRClient),
}));

// Mock Supabase server client (for pipeline schema)
const mockPipelineJobsSelect = vi.fn();
vi.mock('@/lib/supabase/server', () => ({
  supabaseServer: {
    schema: vi.fn(() => ({
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => mockPipelineJobsSelect()),
        })),
      })),
    })),
  },
}));

// Mock Inngest client
const mockSend = vi.fn();
vi.mock('@/lib/inngest/client', () => ({
  inngest: {
    send: (...args: unknown[]) => mockSend(...args),
  },
}));

// Import route handler AFTER mocks are set up
import { POST } from '@/app/api/datasets/[datasetId]/run-to-completion/route';

describe('POST /api/datasets/[datasetId]/run-to-completion', () => {
  const mockDatasetId = 'test-dataset-123';
  const mockUserId = 'test-user-456';

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';
  });

  it('returns 401 when user is not authenticated', async () => {
    mockAuthGetUser.mockResolvedValue({
      data: { user: null },
      error: { message: 'Not authenticated' },
    });

    const request = new NextRequest(
      `http://localhost/api/datasets/${mockDatasetId}/run-to-completion`,
      { method: 'POST' }
    );

    const response = await POST(request, { params: Promise.resolve({ datasetId: mockDatasetId }) });
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('Authentication required');
  });

  it('returns 404 when dataset not found or access denied', async () => {
    mockAuthGetUser.mockResolvedValue({
      data: { user: { id: mockUserId } },
      error: null,
    });
    mockSelectFromDatasets.mockResolvedValue({
      data: null,
      error: { message: 'Not found' },
    });

    const request = new NextRequest(
      `http://localhost/api/datasets/${mockDatasetId}/run-to-completion`,
      { method: 'POST' }
    );

    const response = await POST(request, { params: Promise.resolve({ datasetId: mockDatasetId }) });
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe('Dataset not found or access denied');
  });

  it('returns 400 when capture job is not complete', async () => {
    mockAuthGetUser.mockResolvedValue({
      data: { user: { id: mockUserId } },
      error: null,
    });
    mockSelectFromDatasets.mockResolvedValue({
      data: { id: mockDatasetId },
      error: null,
    });
    // No completed capture job
    mockPipelineJobsSelect.mockResolvedValue({
      data: [
        { id: 'job-1', type: 'ebay_enrich_listings', status: 'completed', marketplace: 'ebay' },
      ],
      error: null,
    });

    const request = new NextRequest(
      `http://localhost/api/datasets/${mockDatasetId}/run-to-completion`,
      { method: 'POST' }
    );

    const response = await POST(request, { params: Promise.resolve({ datasetId: mockDatasetId }) });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain('Capture job must be completed');
    expect(data.nextStage).toBe('capture');
    expect(mockSend).not.toHaveBeenCalled();
  });

  it('returns 409 when a job is already running', async () => {
    mockAuthGetUser.mockResolvedValue({
      data: { user: { id: mockUserId } },
      error: null,
    });
    mockSelectFromDatasets.mockResolvedValue({
      data: { id: mockDatasetId },
      error: null,
    });
    // One running job
    mockPipelineJobsSelect.mockResolvedValue({
      data: [
        { id: 'job-1', type: 'ebay_refresh_listings', status: 'completed', marketplace: 'ebay' },
        { id: 'job-2', type: 'ebay_enrich_listings', status: 'running', marketplace: 'ebay' },
      ],
      error: null,
    });

    const request = new NextRequest(
      `http://localhost/api/datasets/${mockDatasetId}/run-to-completion`,
      { method: 'POST' }
    );

    const response = await POST(request, { params: Promise.resolve({ datasetId: mockDatasetId }) });
    const data = await response.json();

    expect(response.status).toBe(409);
    expect(data.error).toContain('A job is already running');
    expect(data.runningJobType).toBe('ebay_enrich_listings');
    expect(mockSend).not.toHaveBeenCalled();
  });

  it('returns 400 when all pipeline stages are complete', async () => {
    mockAuthGetUser.mockResolvedValue({
      data: { user: { id: mockUserId } },
      error: null,
    });
    mockSelectFromDatasets.mockResolvedValue({
      data: { id: mockDatasetId },
      error: null,
    });
    // All jobs completed
    mockPipelineJobsSelect.mockResolvedValue({
      data: [
        { id: 'job-1', type: 'ebay_refresh_listings', status: 'completed', marketplace: 'ebay' },
        { id: 'job-2', type: 'ebay_enrich_listings', status: 'completed', marketplace: 'ebay' },
        { id: 'job-3', type: 'ebay_materialize_listings', status: 'completed', marketplace: 'ebay' },
        { id: 'job-4', type: 'sanitize_listings', status: 'completed', marketplace: 'ebay' },
        { id: 'job-5', type: 'reconcile', status: 'completed', marketplace: 'ebay' },
        { id: 'job-6', type: 'analyze_listings', status: 'completed', marketplace: 'ebay' },
      ],
      error: null,
    });

    const request = new NextRequest(
      `http://localhost/api/datasets/${mockDatasetId}/run-to-completion`,
      { method: 'POST' }
    );

    const response = await POST(request, { params: Promise.resolve({ datasetId: mockDatasetId }) });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain('All pipeline stages are already complete');
    expect(mockSend).not.toHaveBeenCalled();
  });

  it('successfully triggers pipeline when capture is complete and jobs remain', async () => {
    mockAuthGetUser.mockResolvedValue({
      data: { user: { id: mockUserId } },
      error: null,
    });
    mockSelectFromDatasets.mockResolvedValue({
      data: { id: mockDatasetId },
      error: null,
    });
    // Capture complete, other jobs pending
    mockPipelineJobsSelect.mockResolvedValue({
      data: [
        { id: 'job-1', type: 'ebay_refresh_listings', status: 'completed', marketplace: 'ebay' },
        { id: 'job-2', type: 'ebay_enrich_listings', status: 'completed', marketplace: 'ebay' },
      ],
      error: null,
    });
    mockSend.mockResolvedValue(undefined);

    const request = new NextRequest(
      `http://localhost/api/datasets/${mockDatasetId}/run-to-completion`,
      { method: 'POST' }
    );

    const response = await POST(request, { params: Promise.resolve({ datasetId: mockDatasetId }) });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.status).toBe('running');
    expect(data.message).toContain('Pipeline started');
    expect(data.remainingStages).toEqual([
      'ebay_materialize_listings',
      'sanitize_listings',
      'reconcile',
      'analyze_listings',
    ]);
    expect(data.stagesCount).toBe(4);
    expect(mockSend).toHaveBeenCalledWith({
      name: 'pipeline/run-to-completion',
      data: {
        datasetId: mockDatasetId,
        completedStages: ['ebay_refresh_listings', 'ebay_enrich_listings'],
        marketplace: 'ebay',
      },
    });
  });

  it('handles Inngest send errors gracefully', async () => {
    mockAuthGetUser.mockResolvedValue({
      data: { user: { id: mockUserId } },
      error: null,
    });
    mockSelectFromDatasets.mockResolvedValue({
      data: { id: mockDatasetId },
      error: null,
    });
    mockPipelineJobsSelect.mockResolvedValue({
      data: [
        { id: 'job-1', type: 'ebay_refresh_listings', status: 'completed', marketplace: 'ebay' },
      ],
      error: null,
    });
    mockSend.mockRejectedValue(new Error('Inngest send failed'));

    const request = new NextRequest(
      `http://localhost/api/datasets/${mockDatasetId}/run-to-completion`,
      { method: 'POST' }
    );

    const response = await POST(request, { params: Promise.resolve({ datasetId: mockDatasetId }) });
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe('Inngest send failed');
  });

  it('handles missing Supabase configuration', async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;

    const request = new NextRequest(
      `http://localhost/api/datasets/${mockDatasetId}/run-to-completion`,
      { method: 'POST' }
    );

    const response = await POST(request, { params: Promise.resolve({ datasetId: mockDatasetId }) });
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe('Supabase configuration missing');
  });
});
