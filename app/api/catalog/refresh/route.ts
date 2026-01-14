// API route to trigger a catalog refresh job via Inngest

import { NextResponse } from 'next/server';
import { inngest } from '@/lib/inngest/client';
import { supabaseServer } from '@/lib/supabase/server';
import { BaseJobService } from '@/lib/jobs/base-job-service';
import type { JobType } from '@/lib/types';

export async function POST() {
  try {
    // Create job record first, before sending to Inngest
    const jobService = new BaseJobService(supabaseServer);
    const job = await jobService.createJob(
      'lego_catalog_refresh' as JobType,
      'rebrickable',
      {}
    );

    // Send event to Inngest with the job ID
    await inngest.send({
      name: 'job/catalog-refresh.triggered',
      data: {
        jobId: job.id,
      },
    });

    // Return the created job so frontend can display it immediately
    return NextResponse.json({
      status: 'queued',
      message: 'Catalog refresh job queued',
      job: {
        id: job.id,
        status: job.status,
        started_at: job.started_at,
        completed_at: job.completed_at,
        error_message: job.error_message,
        metadata: job.metadata,
      },
    });
  } catch (error) {
    console.error('Error triggering catalog refresh:', error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'Unknown error occurred',
      },
      { status: 500 }
    );
  }
}
