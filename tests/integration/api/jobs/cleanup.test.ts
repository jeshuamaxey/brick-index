import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';

// Mock JobCleanupService
const mockCleanupStaleJobs = vi.fn();
const mockCleanupStaleJobsApplicationLevel = vi.fn();
const mockGetStaleJobStats = vi.fn();

vi.mock('@/lib/jobs/job-cleanup-service', () => ({
  JobCleanupService: class {
    cleanupStaleJobs = mockCleanupStaleJobs;
    cleanupStaleJobsApplicationLevel = mockCleanupStaleJobsApplicationLevel;
    getStaleJobStats = mockGetStaleJobStats;
  },
}));

// Mock Supabase server
vi.mock('@/lib/supabase/server', () => ({
  supabaseServer: {},
}));

// Import route handler AFTER mocks
import { POST, GET } from '@/app/api/jobs/cleanup/route';

describe('POST /api/jobs/cleanup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should cleanup stale jobs using database function by default', async () => {
    mockCleanupStaleJobs.mockResolvedValue({
      jobsUpdated: 3,
      jobIds: ['job-1', 'job-2', 'job-3'],
    });

    const request = new NextRequest('http://localhost/api/jobs/cleanup', {
      method: 'POST',
      body: JSON.stringify({}),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.jobsUpdated).toBe(3);
    expect(data.jobIds).toEqual(['job-1', 'job-2', 'job-3']);
    expect(mockCleanupStaleJobs).toHaveBeenCalledTimes(1);
  });

  it('should use application-level cleanup when requested', async () => {
    mockCleanupStaleJobsApplicationLevel.mockResolvedValue({
      jobsUpdated: 2,
      jobIds: ['job-1', 'job-2'],
    });

    const request = new NextRequest('http://localhost/api/jobs/cleanup', {
      method: 'POST',
      body: JSON.stringify({ useApplicationLevel: true }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.jobsUpdated).toBe(2);
    expect(mockCleanupStaleJobsApplicationLevel).toHaveBeenCalledTimes(1);
    expect(mockCleanupStaleJobs).not.toHaveBeenCalled();
  });

  it('should handle cleanup errors', async () => {
    // Mock both methods to fail to test error handling
    mockCleanupStaleJobs.mockRejectedValue(new Error('Database function failed'));
    mockCleanupStaleJobsApplicationLevel.mockRejectedValue(new Error('Application level failed'));

    const request = new NextRequest('http://localhost/api/jobs/cleanup', {
      method: 'POST',
      body: JSON.stringify({}),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.success).toBe(false);
    expect(data.error).toContain('failed');
    // Should try database function first, then fallback to application level
    expect(mockCleanupStaleJobs).toHaveBeenCalledTimes(1);
    expect(mockCleanupStaleJobsApplicationLevel).toHaveBeenCalledTimes(1);
  });

  it('should handle empty body gracefully', async () => {
    mockCleanupStaleJobs.mockResolvedValue({
      jobsUpdated: 0,
      jobIds: [],
    });

    const request = new NextRequest('http://localhost/api/jobs/cleanup', {
      method: 'POST',
      body: JSON.stringify({}),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.jobsUpdated).toBe(0);
  });
});

describe('GET /api/jobs/cleanup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return stale job statistics', async () => {
    mockGetStaleJobStats.mockResolvedValue({
      runningJobs: 5,
      potentiallyStale: 2,
      oldestRunningJob: new Date().toISOString(),
    });

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.stats.runningJobs).toBe(5);
    expect(data.stats.potentiallyStale).toBe(2);
    expect(mockGetStaleJobStats).toHaveBeenCalledTimes(1);
  });

  it('should handle stats errors', async () => {
    mockGetStaleJobStats.mockRejectedValue(new Error('Stats failed'));

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.success).toBe(false);
    expect(data.error).toBe('Stats failed');
  });
});
