// Inngest serve endpoint - registers all Inngest functions

import { serve } from 'inngest/next';
import { inngest } from '@/lib/inngest/client';
import { captureJob } from './functions/capture-job';
import { materializeListingsJob } from './functions/materialize-listings-job';
import { enrichJob } from './functions/enrich-job';
import { analyzeJob } from './functions/analyze-job';
import { handleJobCancellation } from './functions/handle-job-cancellation';

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [captureJob, materializeListingsJob, enrichJob, analyzeJob, handleJobCancellation],
});

