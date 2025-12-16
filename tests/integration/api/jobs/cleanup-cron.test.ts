import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';

// Mock JobCleanupService
const mockCleanupStaleJobs = vi.fn();

vi.mock('@/lib/jobs/job-cleanup-service', () => ({
  JobCleanupService: class {
    cleanupStaleJobs = mockCleanupStaleJobs;
  },
}));

// Mock Supabase server
vi.mock('@/lib/supabase/server', () => ({
  supabaseServer: {},
}));

// Import route handler AFTER mocks
import { GET } from '@/app/api/jobs/cleanup/cron/route';

describe('GET /api/jobs/cleanup/cron', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.CRON_SECRET;
  });

  it('should cleanup stale jobs when called without auth', async () => {
    mockCleanupStaleJobs.mockResolvedValue({
      jobsUpdated: 2,
      jobIds: ['job-1', 'job-2'],
    });

    const request = new NextRequest('http://localhost/api/jobs/cleanup/cron', {
      method: 'GET',
    });

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.jobsUpdated).toBe(2);
    expect(data.timestamp).toBeDefined();
    expect(mockCleanupStaleJobs).toHaveBeenCalledTimes(1);
  });

  it('should require auth when CRON_SECRET is set', async () => {
    process.env.CRON_SECRET = 'test-secret';

    const request = new NextRequest('http://localhost/api/jobs/cleanup/cron', {
      method: 'GET',
    });

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('Unauthorized');
    expect(mockCleanupStaleJobs).not.toHaveBeenCalled();
  });

  it('should allow access with correct CRON_SECRET', async () => {
    process.env.CRON_SECRET = 'test-secret';
    mockCleanupStaleJobs.mockResolvedValue({
      jobsUpdated: 1,
      jobIds: ['job-1'],
    });

    const request = new NextRequest('http://localhost/api/jobs/cleanup/cron', {
      method: 'GET',
      headers: {
        authorization: 'Bearer test-secret',
      },
    });

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(mockCleanupStaleJobs).toHaveBeenCalledTimes(1);
  });

  it('should handle cleanup errors', async () => {
    mockCleanupStaleJobs.mockRejectedValue(new Error('Cleanup failed'));

    const request = new NextRequest('http://localhost/api/jobs/cleanup/cron', {
      method: 'GET',
    });

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.success).toBe(false);
    expect(data.error).toBe('Cleanup failed');
    expect(data.timestamp).toBeDefined();
  });
});
