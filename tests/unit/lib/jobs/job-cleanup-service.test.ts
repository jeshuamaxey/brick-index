import { describe, it, expect, beforeEach, vi } from 'vitest';
import { JobCleanupService } from '@/lib/jobs/job-cleanup-service';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/supabase.types';

describe('JobCleanupService', () => {
  let mockSupabase: SupabaseClient<Database>;
  let service: JobCleanupService;

  beforeEach(() => {
    // Create mock Supabase client
    mockSupabase = {
      rpc: vi.fn(),
      schema: vi.fn(() => ({
        from: vi.fn(() => ({
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              or: vi.fn(() => ({
                order: vi.fn(() => ({
                  limit: vi.fn(() => Promise.resolve({ data: [], error: null })),
                })),
              })),
            })),
          })),
          update: vi.fn(() => ({
            eq: vi.fn(() => Promise.resolve({ error: null })),
          })),
        })),
      })),
    } as unknown as SupabaseClient<Database>;

    service = new JobCleanupService(mockSupabase);
  });

  describe('cleanupStaleJobs', () => {
    it('should call the database function to cleanup stale jobs', async () => {
      const mockResult = {
        jobs_updated: 2,
        job_ids: ['job-1', 'job-2'],
      };

      (mockSupabase.rpc as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: [mockResult],
        error: null,
      });

      const result = await service.cleanupStaleJobs();

      expect(mockSupabase.rpc).toHaveBeenCalledWith(
        'mark_stale_jobs_as_timed_out'
      );
      expect(result.jobsUpdated).toBe(2);
      expect(result.jobIds).toEqual(['job-1', 'job-2']);
    });

    it('should return empty result when no stale jobs found', async () => {
      (mockSupabase.rpc as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: [{ jobs_updated: 0, job_ids: [] }],
        error: null,
      });

      const result = await service.cleanupStaleJobs();

      expect(result.jobsUpdated).toBe(0);
      expect(result.jobIds).toEqual([]);
    });

    it('should handle database function errors', async () => {
      (mockSupabase.rpc as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: null,
        error: { message: 'Database error' },
      });

      await expect(service.cleanupStaleJobs()).rejects.toThrow(
        'Failed to cleanup stale jobs'
      );
    });

    it('should handle null job_ids from database', async () => {
      (mockSupabase.rpc as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: [{ jobs_updated: 1, job_ids: null }],
        error: null,
      });

      const result = await service.cleanupStaleJobs();

      expect(result.jobsUpdated).toBe(1);
      expect(result.jobIds).toEqual([]);
    });
  });

  describe('cleanupStaleJobsApplicationLevel', () => {
    it('should find and update stale jobs based on updated_at', async () => {
      const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
      const now = new Date();

      const staleJobs = [
        {
          id: 'job-1',
          started_at: new Date(Date.now() - 20 * 60 * 1000).toISOString(),
          updated_at: tenMinutesAgo.toISOString(),
          timeout_at: null,
        },
        {
          id: 'job-2',
          started_at: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
          updated_at: tenMinutesAgo.toISOString(),
          timeout_at: null,
        },
      ];

      // Mock the query chain
      const mockFrom = vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            or: vi.fn(() =>
              Promise.resolve({ data: staleJobs, error: null })
            ),
          })),
        })),
        update: vi.fn(() => ({
          eq: vi.fn(() => Promise.resolve({ error: null })),
        })),
      }));

      (mockSupabase.schema as ReturnType<typeof vi.fn>).mockReturnValue({
        from: mockFrom,
      });

      const result = await service.cleanupStaleJobsApplicationLevel();

      expect(result.jobsUpdated).toBe(2);
      expect(result.jobIds).toHaveLength(2);
      expect(result.jobIds).toContain('job-1');
      expect(result.jobIds).toContain('job-2');
    });

    it('should find stale jobs based on timeout_at', async () => {
      const pastTimeout = new Date(Date.now() - 5 * 60 * 1000);

      const staleJobs = [
        {
          id: 'job-1',
          started_at: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
          updated_at: new Date().toISOString(),
          timeout_at: pastTimeout.toISOString(),
        },
      ];

      const mockFrom = vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            or: vi.fn(() =>
              Promise.resolve({ data: staleJobs, error: null })
            ),
          })),
        })),
        update: vi.fn(() => ({
          eq: vi.fn(() => Promise.resolve({ error: null })),
        })),
      }));

      (mockSupabase.schema as ReturnType<typeof vi.fn>).mockReturnValue({
        from: mockFrom,
      });

      const result = await service.cleanupStaleJobsApplicationLevel();

      expect(result.jobsUpdated).toBe(1);
      expect(result.jobIds).toContain('job-1');
    });

    it('should find stale jobs based on absolute maximum (60 minutes)', async () => {
      const sixtyMinutesAgo = new Date(Date.now() - 61 * 60 * 1000);

      const staleJobs = [
        {
          id: 'job-1',
          started_at: sixtyMinutesAgo.toISOString(),
          updated_at: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
          timeout_at: null,
        },
      ];

      const mockFrom = vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            or: vi.fn(() =>
              Promise.resolve({ data: staleJobs, error: null })
            ),
          })),
        })),
        update: vi.fn(() => ({
          eq: vi.fn(() => Promise.resolve({ error: null })),
        })),
      }));

      (mockSupabase.schema as ReturnType<typeof vi.fn>).mockReturnValue({
        from: mockFrom,
      });

      const result = await service.cleanupStaleJobsApplicationLevel();

      expect(result.jobsUpdated).toBe(1);
    });

    it('should handle update errors gracefully', async () => {
      const staleJobs = [
        {
          id: 'job-1',
          started_at: new Date(Date.now() - 20 * 60 * 1000).toISOString(),
          updated_at: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
          timeout_at: null,
        },
      ];

      const mockFrom = vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            or: vi.fn(() =>
              Promise.resolve({ data: staleJobs, error: null })
            ),
          })),
        })),
        update: vi.fn(() => ({
          eq: vi.fn(() =>
            Promise.resolve({ error: { message: 'Update failed' } })
          ),
        })),
      }));

      (mockSupabase.schema as ReturnType<typeof vi.fn>).mockReturnValue({
        from: mockFrom,
      });

      const result = await service.cleanupStaleJobsApplicationLevel();

      // Should still return job IDs but count may be less if updates fail
      expect(result.jobIds).toContain('job-1');
    });

    it('should return empty result when no stale jobs found', async () => {
      const mockFrom = vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            or: vi.fn(() => Promise.resolve({ data: [], error: null })),
          })),
        })),
      }));

      (mockSupabase.schema as ReturnType<typeof vi.fn>).mockReturnValue({
        from: mockFrom,
      });

      const result = await service.cleanupStaleJobsApplicationLevel();

      expect(result.jobsUpdated).toBe(0);
      expect(result.jobIds).toEqual([]);
    });
  });

  describe('getStaleJobStats', () => {
    it('should return statistics about running and stale jobs', async () => {
      const oldestJob = {
        id: 'job-1',
        started_at: new Date(Date.now() - 20 * 60 * 1000).toISOString(),
        updated_at: new Date().toISOString(),
        timeout_at: null,
      };

      // Create proper mock chain for each query
      const mockLimit = vi.fn(() =>
        Promise.resolve({ data: [oldestJob], error: null })
      );
      const mockOrder = vi.fn(() => ({ limit: mockLimit }));
      const mockEqRunning = vi.fn(() => ({ order: mockOrder }));
      const mockSelectRunning = vi.fn(() => ({ eq: mockEqRunning }));

      const mockOr = vi.fn(() =>
        Promise.resolve({ count: 2, error: null })
      );
      const mockEqStale = vi.fn(() => ({ or: mockOr }));
      const mockSelectStale = vi.fn(() => ({ eq: mockEqStale }));

      // Mock total running count (third call)
      // select() with head:true returns chainable, eq() returns promise
      const mockEqTotal = vi.fn(() =>
        Promise.resolve({ count: 5, error: null })
      );
      const mockSelectTotal = vi.fn(() => ({ eq: mockEqTotal }));

      let callCount = 0;
      const mockFrom = vi.fn(() => {
        callCount++;
        if (callCount === 1) {
          // First call: get oldest running job
          return {
            select: mockSelectRunning,
          };
        } else if (callCount === 2) {
          // Second call: count stale jobs
          return {
            select: mockSelectStale,
          };
        } else {
          // Third call: count total running
          return {
            select: mockSelectTotal,
          };
        }
      });

      (mockSupabase.schema as ReturnType<typeof vi.fn>).mockReturnValue({
        from: mockFrom,
      });

      const stats = await service.getStaleJobStats();

      expect(stats.runningJobs).toBe(5);
      expect(stats.potentiallyStale).toBe(2);
      expect(stats.oldestRunningJob).toBe(oldestJob.started_at);
    });

    it('should handle no running jobs', async () => {
      // Mock all three queries to return empty/zero
      const mockLimit = vi.fn(() =>
        Promise.resolve({ data: [], error: null })
      );
      const mockOrder = vi.fn(() => ({ limit: mockLimit }));
      const mockEqRunning = vi.fn(() => ({ order: mockOrder }));
      const mockSelectRunning = vi.fn(() => ({ eq: mockEqRunning }));

      const mockOr = vi.fn(() =>
        Promise.resolve({ count: 0, error: null })
      );
      const mockEqStale = vi.fn(() => ({ or: mockOr }));
      const mockSelectStale = vi.fn(() => ({ eq: mockEqStale }));

      // Mock total running count (third call)
      const mockEqTotal = vi.fn(() =>
        Promise.resolve({ count: 0, error: null })
      );
      const mockSelectTotal = vi.fn(() => ({ eq: mockEqTotal }));

      let callCount = 0;
      const mockFrom = vi.fn(() => {
        callCount++;
        if (callCount === 1) {
          return { select: mockSelectRunning };
        } else if (callCount === 2) {
          return { select: mockSelectStale };
        } else {
          return { select: mockSelectTotal };
        }
      });

      (mockSupabase.schema as ReturnType<typeof vi.fn>).mockReturnValue({
        from: mockFrom,
      });

      const stats = await service.getStaleJobStats();

      expect(stats.runningJobs).toBe(0);
      expect(stats.potentiallyStale).toBe(0);
      expect(stats.oldestRunningJob).toBeNull();
    });
  });
});
