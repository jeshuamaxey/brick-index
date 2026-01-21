// Inngest function for running the entire pipeline to completion
// Orchestrates all remaining jobs sequentially, stopping on failure

import { inngest } from '@/lib/inngest/client';
import { supabaseServer } from '@/lib/supabase/server';
import { BaseJobService } from '@/lib/jobs/base-job-service';
import { INNGEST_FUNCTION_IDS } from './registry';

// Import job functions for step.invoke
import { enrichJob } from './enrich-job';
import { materializeListingsJob } from './materialize-listings-job';
import { sanitizeJob } from './sanitize-job';
import { reconcileJob } from './reconcile-job';
import { analyzeJob } from './analyze-job';

// Pipeline stages in order (excluding capture which requires manual trigger)
const PIPELINE_ORDER = [
  'ebay_refresh_listings',
  'ebay_enrich_listings',
  'ebay_materialize_listings',
  'sanitize_listings',
  'reconcile',
  'analyze_listings',
] as const;

type PipelineStage = (typeof PIPELINE_ORDER)[number];

// Map job types to their Inngest functions
const JOB_FUNCTIONS: Partial<Record<PipelineStage, typeof enrichJob>> = {
  ebay_enrich_listings: enrichJob,
  ebay_materialize_listings: materializeListingsJob,
  sanitize_listings: sanitizeJob,
  reconcile: reconcileJob,
  analyze_listings: analyzeJob,
};

interface RunPipelineEvent {
  name: 'pipeline/run-to-completion';
  data: {
    datasetId: string;
    completedStages: string[];
    marketplace?: string;
  };
}

export const runPipelineToCompletion = inngest.createFunction(
  { id: INNGEST_FUNCTION_IDS.RUN_PIPELINE_TO_COMPLETION },
  { event: 'pipeline/run-to-completion' },
  async ({ event, step }) => {
    const { datasetId, completedStages, marketplace = 'ebay' } = event.data;

    // Step 1: Determine remaining jobs to run
    const remainingJobs = PIPELINE_ORDER.filter(
      (stage) => !completedStages.includes(stage) && stage !== 'ebay_refresh_listings'
    );

    if (remainingJobs.length === 0) {
      return {
        status: 'completed',
        message: 'All pipeline stages are already complete',
        datasetId,
      };
    }

    // Step 2: Get the capture job ID (needed for enrich and materialize)
    const captureJobId = await step.run('get-capture-job-id', async () => {
      const { data: captureJobs, error } = await supabaseServer
        .schema('pipeline')
        .from('jobs')
        .select('id')
        .eq('dataset_id', datasetId)
        .eq('type', 'ebay_refresh_listings')
        .eq('status', 'completed')
        .order('started_at', { ascending: false })
        .limit(1);

      if (error) {
        throw new Error(`Failed to get capture job: ${error.message}`);
      }

      if (!captureJobs || captureJobs.length === 0) {
        throw new Error('No completed capture job found for this dataset');
      }

      return captureJobs[0].id;
    });

    // Step 3: Run each remaining job sequentially
    const results: Array<{ stage: string; status: string; jobId?: string }> = [];

    for (const jobType of remainingJobs) {
      const jobFunction = JOB_FUNCTIONS[jobType];
      
      if (!jobFunction) {
        // Skip stages that can't be auto-triggered (like capture)
        continue;
      }

      // Build the event data for this job
      const eventData: Record<string, unknown> = {
        datasetId,
      };

      // Add captureJobId for jobs that need it
      if (jobType === 'ebay_enrich_listings' || jobType === 'ebay_materialize_listings') {
        eventData.captureJobId = captureJobId;
        eventData.marketplace = marketplace;
      }

      // Invoke the job and wait for completion
      // If the job fails, step.invoke will throw, stopping the orchestrator
      const result = await step.invoke(`run-${jobType}`, {
        function: jobFunction,
        data: eventData,
      });

      results.push({
        stage: jobType,
        status: 'completed',
        jobId: result?.jobId,
      });

      // Update progress after each job
      await step.run(`log-progress-${jobType}`, async () => {
        console.log(`[Pipeline] Completed ${jobType} for dataset ${datasetId}`);
      });
    }

    return {
      status: 'completed',
      message: `Pipeline completed: ${results.length} jobs executed`,
      datasetId,
      results,
    };
  }
);
