// Inngest serve endpoint - registers all Inngest functions

import { serve } from 'inngest/next';
import { inngest } from '@/lib/inngest/client';
import { captureJob } from './functions/capture-job';
import { enrichJob } from './functions/enrich-job';
import { analyzeJob } from './functions/analyze-job';

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [captureJob, enrichJob, analyzeJob],
});
