// Service for detecting and cleaning up stale jobs

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/supabase.types';

export interface CleanupResult {
  jobsUpdated: number;
  jobIds: string[];
}

export class JobCleanupService {
  constructor(private supabase: SupabaseClient<Database>) {}

  /**
   * Detect and mark stale jobs as timed out using the database function
   * This is the primary method - uses the database function for efficiency
   */
  async cleanupStaleJobs(): Promise<CleanupResult> {
    // Type assertion needed because the database function is not in generated types yet
    const { data, error } = await (this.supabase.rpc as any)(
      'mark_stale_jobs_as_timed_out'
    );

    if (error) {
      throw new Error(
        `Failed to cleanup stale jobs: ${error.message || JSON.stringify(error)}`
      );
    }

    if (!data || (Array.isArray(data) && data.length === 0)) {
      return { jobsUpdated: 0, jobIds: [] };
    }

    const result = (Array.isArray(data) ? data[0] : data) as { jobs_updated: number; job_ids: string[] | null };
    return {
      jobsUpdated: result.jobs_updated || 0,
      jobIds: result.job_ids || [],
    };
  }

  /**
   * Alternative cleanup method using application-level logic
   * Useful as a fallback or for more complex cleanup logic
   */
  async cleanupStaleJobsApplicationLevel(): Promise<CleanupResult> {
    const now = new Date();
    const tenMinutesAgo = new Date(now.getTime() - 10 * 60 * 1000);
    const sixtyMinutesAgo = new Date(now.getTime() - 60 * 60 * 1000);

    // Find stale jobs
    const { data: staleJobs, error: queryError } = await this.supabase
      .schema('pipeline')
      .from('jobs')
      .select('id, started_at, updated_at, timeout_at')
      .eq('status', 'running')
      .or(
        `updated_at.lt.${tenMinutesAgo.toISOString()},timeout_at.lt.${now.toISOString()},started_at.lt.${sixtyMinutesAgo.toISOString()}`
      );

    if (queryError) {
      throw new Error(`Failed to query stale jobs: ${queryError.message}`);
    }

    if (!staleJobs || staleJobs.length === 0) {
      return { jobsUpdated: 0, jobIds: [] };
    }

    const staleJobIds = staleJobs.map((job: any) => job.id);

    // Calculate timeout duration for each job
    const updates = staleJobs.map((job: any) => {
      const startedAt = new Date(job.started_at || now);
      const durationMinutes = Math.round(
        (now.getTime() - startedAt.getTime()) / (60 * 1000)
      );

      return {
        id: job.id,
        status: 'failed',
        completed_at: now.toISOString(),
        updated_at: now.toISOString(),
        last_update: `Job timed out: No progress detected or exceeded maximum runtime`,
        error_message: `Job timed out after ${durationMinutes} minutes`,
      };
    });

    // Update all stale jobs
    let updatedCount = 0;
    for (const update of updates) {
      const { error: updateError } = await this.supabase
        .schema('pipeline')
        .from('jobs')
        .update({
          status: update.status,
          completed_at: update.completed_at,
          updated_at: update.updated_at,
          last_update: update.last_update,
          error_message: update.error_message,
        })
        .eq('id', update.id);

      if (!updateError) {
        updatedCount++;
      } else {
        console.error(`Failed to update stale job ${update.id}:`, updateError);
      }
    }

    return {
      jobsUpdated: updatedCount,
      jobIds: staleJobIds,
    };
  }

  /**
   * Get statistics about potentially stale jobs (for monitoring)
   */
  async getStaleJobStats(): Promise<{
    runningJobs: number;
    potentiallyStale: number;
    oldestRunningJob: string | null;
  }> {
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const now = new Date().toISOString();

    // Get oldest running job
    const { data: runningJobs, error: runningError } = await this.supabase
      .schema('pipeline')
      .from('jobs')
      .select('id, started_at, updated_at, timeout_at')
      .eq('status', 'running')
      .order('started_at', { ascending: true })
      .limit(1);

    if (runningError) {
      throw new Error(`Failed to query running jobs: ${runningError.message}`);
    }

    const runningJobsArray = (runningJobs as unknown) as Array<{ started_at: string | null }> | null;

    // Count potentially stale jobs
    const sixtyMinutesAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count: staleCount, error: staleError } = await this.supabase
      .schema('pipeline')
      .from('jobs')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'running')
      .or(
        `updated_at.lt.${tenMinutesAgo},timeout_at.lt.${now},started_at.lt.${sixtyMinutesAgo}`
      );

    if (staleError) {
      throw new Error(`Failed to count stale jobs: ${staleError.message}`);
    }

    // Get total running jobs count
    const { count: totalRunning, error: totalError } = await this.supabase
      .schema('pipeline')
      .from('jobs')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'running');

    if (totalError) {
      throw new Error(`Failed to count running jobs: ${totalError.message}`);
    }

    return {
      runningJobs: totalRunning || 0,
      potentiallyStale: staleCount || 0,
      oldestRunningJob:
        runningJobsArray && runningJobsArray.length > 0
          ? runningJobsArray[0].started_at || null
          : null,
    };
  }
}
