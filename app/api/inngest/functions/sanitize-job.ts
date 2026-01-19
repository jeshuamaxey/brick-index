// Inngest function for sanitize jobs (placeholder)
// This is a placeholder job with no business logic - to be implemented later

import { inngest } from '@/lib/inngest/client';
import { supabaseServer } from '@/lib/supabase/server';
import { BaseJobService } from '@/lib/jobs/base-job-service';
import type { JobType } from '@/lib/types';

interface SanitizeJobEvent {
  name: 'job/sanitize.triggered';
  data: {
    listingIds?: string[];
    limit?: number;
  };
}

import { INNGEST_FUNCTION_IDS } from './registry';

export const sanitizeJob = inngest.createFunction(
  { id: INNGEST_FUNCTION_IDS.SANITIZE_JOB },
  { event: 'job/sanitize.triggered' },
  async ({ event, step }) => {
    const { listingIds, limit } = event.data;

    // Step 1: Create job record
    const job = await step.run('create-job', async () => {
      const jobService = new BaseJobService(supabaseServer);
      return await jobService.createJob(
        'sanitize_listings' as JobType,
        'all', // Marketplace doesn't really apply to sanitize
        {
          listingIds: listingIds || null,
          limit: limit || null,
        }
      );
    });

    const jobId = job.id;

    // Step 2: Placeholder - complete immediately
    // This job is a placeholder and does not perform any actual work
    await step.run('complete-job-placeholder', async () => {
      const jobService = new BaseJobService(supabaseServer);
      await jobService.completeJob(
        jobId,
        { listings_found: 0, listings_new: 0, listings_updated: 0 },
        'Sanitize job is a placeholder - no business logic implemented yet'
      );
    });

    return {
      jobId,
      message: 'Sanitize job completed (placeholder - no business logic)',
    };
  }
);
