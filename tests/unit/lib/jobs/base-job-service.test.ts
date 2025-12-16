import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BaseJobService } from '@/lib/jobs/base-job-service';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/supabase.types';

describe('BaseJobService - Timeout Configuration', () => {
  let mockSupabase: SupabaseClient<Database>;
  let service: BaseJobService;

  beforeEach(() => {
    mockSupabase = {
      schema: vi.fn(() => ({
        from: vi.fn(() => ({
          insert: vi.fn(() => ({
            select: vi.fn(() => ({
              single: vi.fn(() =>
                Promise.resolve({
                  data: {
                    id: 'test-job-id',
                    type: 'ebay_refresh_listings',
                    marketplace: 'ebay',
                    status: 'running',
                    started_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                    timeout_at: null,
                  },
                  error: null,
                })
              ),
            })),
          })),
        })),
      })),
    } as unknown as SupabaseClient<Database>;

    service = new BaseJobService(mockSupabase);
  });

  it('should set timeout_at for ebay_refresh_listings (30 minutes)', async () => {
    const mockInsert = vi.fn(() => ({
      select: vi.fn(() => ({
        single: vi.fn(() =>
          Promise.resolve({
            data: {
              id: 'test-job-id',
              type: 'ebay_refresh_listings',
              marketplace: 'ebay',
              status: 'running',
              started_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              timeout_at: new Date().toISOString(),
            },
            error: null,
          })
        ),
      })),
    }));

    const mockFrom = vi.fn(() => ({
      insert: mockInsert,
    }));

    (mockSupabase.schema as ReturnType<typeof vi.fn>).mockReturnValue({
      from: mockFrom,
    });

    const beforeTime = Date.now();
    await service.createJob('ebay_refresh_listings', 'ebay');
    const afterTime = Date.now();

    expect(mockInsert).toHaveBeenCalled();
    expect(mockInsert.mock.calls.length).toBeGreaterThan(0);
    const insertCall = (mockInsert.mock.calls as any)[0]?.[0] as any;
    expect(insertCall).toBeDefined();
    expect(insertCall?.timeout_at).toBeDefined();
    
    if (insertCall?.timeout_at) {
      const timeoutAt = new Date(insertCall.timeout_at).getTime();
      const expectedMinTimeout = beforeTime + 30 * 60 * 1000; // 30 minutes from start
      const expectedMaxTimeout = afterTime + 30 * 60 * 1000; // 30 minutes from end
      
      // Timeout should be approximately 30 minutes from when the job was created
      expect(timeoutAt).toBeGreaterThanOrEqual(expectedMinTimeout - 1000); // Allow 1 second variance
      expect(timeoutAt).toBeLessThanOrEqual(expectedMaxTimeout + 1000);
      
      // Verify it's approximately 30 minutes (within 5 seconds)
      const timeoutDuration = timeoutAt - (beforeTime + afterTime) / 2;
      expect(timeoutDuration).toBeCloseTo(30 * 60 * 1000, -3); // Within 1 second
    }
  });

  it('should set timeout_at for ebay_enrich_listings (60 minutes)', async () => {
    const mockInsert = vi.fn(() => ({
      select: vi.fn(() => ({
        single: vi.fn(() =>
          Promise.resolve({
            data: {
              id: 'test-job-id',
              type: 'ebay_enrich_listings',
              marketplace: 'ebay',
              status: 'running',
              started_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              timeout_at: new Date().toISOString(),
            },
            error: null,
          })
        ),
      })),
    }));

    const mockFrom = vi.fn(() => ({
      insert: mockInsert,
    }));

    (mockSupabase.schema as ReturnType<typeof vi.fn>).mockReturnValue({
      from: mockFrom,
    });

    const beforeTime = Date.now();
    await service.createJob('ebay_enrich_listings', 'ebay');
    const afterTime = Date.now();

    expect(mockInsert.mock.calls.length).toBeGreaterThan(0);
    const insertCall = (mockInsert.mock.calls as any)[0]?.[0] as any;
    expect(insertCall).toBeDefined();
    
    if (insertCall?.timeout_at) {
      const timeoutAt = new Date(insertCall.timeout_at).getTime();
      const midTime = (beforeTime + afterTime) / 2;
      const timeoutDuration = timeoutAt - midTime;
      
      // Verify it's approximately 60 minutes (within 5 seconds)
      expect(timeoutDuration).toBeCloseTo(60 * 60 * 1000, -3);
    }
  });

  it('should set timeout_at for analyze_listings (15 minutes)', async () => {
    const mockInsert = vi.fn(() => ({
      select: vi.fn(() => ({
        single: vi.fn(() =>
          Promise.resolve({
            data: {
              id: 'test-job-id',
              type: 'analyze_listings',
              marketplace: 'all',
              status: 'running',
              started_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              timeout_at: new Date().toISOString(),
            },
            error: null,
          })
        ),
      })),
    }));

    const mockFrom = vi.fn(() => ({
      insert: mockInsert,
    }));

    (mockSupabase.schema as ReturnType<typeof vi.fn>).mockReturnValue({
      from: mockFrom,
    });

    const beforeTime = Date.now();
    await service.createJob('analyze_listings' as any, 'all');
    const afterTime = Date.now();

    expect(mockInsert.mock.calls.length).toBeGreaterThan(0);
    const insertCall = (mockInsert.mock.calls as any)[0]?.[0] as any;
    expect(insertCall).toBeDefined();
    
    if (insertCall?.timeout_at) {
      const timeoutAt = new Date(insertCall.timeout_at).getTime();
      const midTime = (beforeTime + afterTime) / 2;
      const timeoutDuration = timeoutAt - midTime;
      
      // Verify it's approximately 15 minutes (within 5 seconds)
      expect(timeoutDuration).toBeCloseTo(15 * 60 * 1000, -3);
    }
  });

  it('should use default timeout (30 minutes) for unknown job types', async () => {
    const mockInsert = vi.fn(() => ({
      select: vi.fn(() => ({
        single: vi.fn(() =>
          Promise.resolve({
            data: {
              id: 'test-job-id',
              type: 'unknown_job_type' as any,
              marketplace: 'test',
              status: 'running',
              started_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              timeout_at: new Date().toISOString(),
            },
            error: null,
          })
        ),
      })),
    }));

    const mockFrom = vi.fn(() => ({
      insert: mockInsert,
    }));

    (mockSupabase.schema as ReturnType<typeof vi.fn>).mockReturnValue({
      from: mockFrom,
    });

    const beforeTime = Date.now();
    await service.createJob('unknown_job_type' as any, 'test');
    const afterTime = Date.now();

    expect(mockInsert.mock.calls.length).toBeGreaterThan(0);
    const insertCall = (mockInsert.mock.calls as any)[0]?.[0] as any;
    expect(insertCall).toBeDefined();
    
    if (insertCall?.timeout_at) {
      const timeoutAt = new Date(insertCall.timeout_at).getTime();
      const midTime = (beforeTime + afterTime) / 2;
      const timeoutDuration = timeoutAt - midTime;
      
      // Verify it's approximately 30 minutes (default, within 5 seconds)
      expect(timeoutDuration).toBeCloseTo(30 * 60 * 1000, -3);
    }
  });
});
