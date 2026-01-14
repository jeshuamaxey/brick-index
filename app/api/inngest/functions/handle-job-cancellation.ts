// Inngest function to handle job cancellations
// Listens to Inngest's cancellation system event and updates job status in database

import { inngest } from '@/lib/inngest/client';
import { supabaseServer } from '@/lib/supabase/server';
import { BaseJobService } from '@/lib/jobs/base-job-service';
import { FUNCTION_TO_JOB_TYPE, extractFunctionName, INNGEST_FUNCTION_IDS } from './registry';
import type { JobType } from '@/lib/types';
import type { Database } from '@/lib/supabase/supabase.types';

export const handleJobCancellation = inngest.createFunction(
  { id: INNGEST_FUNCTION_IDS.HANDLE_JOB_CANCELLATION },
  { event: 'inngest/function.cancelled' },
  async ({ event, step }) => {
    const { function_id, event: originalEvent, run_id } = event.data;

    await step.run('update-cancelled-job', async () => {
      const jobService = new BaseJobService(supabaseServer);

      // Extract function name from full function_id (remove app ID prefix)
      const functionName = extractFunctionName(function_id);
      if (!functionName) {
        console.warn(`Could not extract function name from function_id: ${function_id}`);
        return;
      }

      // Get job type from function name
      const jobType = FUNCTION_TO_JOB_TYPE[functionName];
      if (!jobType) {
        console.warn(`Unknown function name: ${functionName} (from function_id: ${function_id}), skipping cancellation update`);
        return;
      }

      // Type assertion: jobType is guaranteed to be a valid JobType from FUNCTION_TO_JOB_TYPE
      const validJobType = jobType as JobType;

      // For materialize jobs, we can match by captureJobId in metadata
      let jobId: string | null = null;
      
      if (functionName === INNGEST_FUNCTION_IDS.MATERIALIZE_LISTINGS_JOB && originalEvent.data?.captureJobId) {
        // Find materialize job by captureJobId in metadata
        const { data: jobs } = await supabaseServer
          .schema('pipeline')
          .from('jobs')
          .select('id, metadata')
          .eq('type', validJobType as Database['pipeline']['Enums']['job_type'])
          .eq('status', 'running')
          .order('started_at', { ascending: false });

        if (jobs) {
          // Find job with matching captureJobId in metadata
          for (const job of jobs) {
            const metadata = job.metadata as { captureJobId?: string } | null;
            if (metadata?.captureJobId === originalEvent.data.captureJobId) {
              jobId = job.id;
              break;
            }
          }
        }
      }

      // Fallback: Find most recent running job of matching type and marketplace
      if (!jobId) {
        // Determine marketplace based on job type or event data
        let marketplace: string;
        if (validJobType === 'lego_catalog_refresh') {
          marketplace = 'rebrickable';
        } else {
          marketplace = originalEvent.data?.marketplace || 'ebay';
        }

        const { data: jobs } = await supabaseServer
          .schema('pipeline')
          .from('jobs')
          .select('id')
          .eq('type', validJobType as Database['pipeline']['Enums']['job_type'])
          .eq('status', 'running')
          .eq('marketplace', marketplace)
          .order('started_at', { ascending: false })
          .limit(1);

        if (jobs && jobs.length > 0) {
          jobId = jobs[0].id;
        }
      }

      if (jobId) {
        await jobService.failJob(jobId, 'Job cancelled via Inngest UI');
        console.log(`Marked job ${jobId} as cancelled (function: ${functionName}, function_id: ${function_id}, run_id: ${run_id})`);
      } else {
        console.warn(
          `Could not find running job to cancel for function: ${functionName} (function_id: ${function_id}), run_id: ${run_id}`
        );
      }
    });
  }
);

