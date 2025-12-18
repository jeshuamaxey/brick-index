// API route to cancel a running job

import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';
import { BaseJobService } from '@/lib/jobs/base-job-service';

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ jobId: string }> }
) {
  try {
    const { jobId } = await context.params;

    // Verify job exists and is running
    const { data: job, error: fetchError } = await supabaseServer
      .schema('pipeline')
      .from('jobs')
      .select('id, status')
      .eq('id', jobId)
      .single();

    if (fetchError) {
      return NextResponse.json(
        { error: fetchError.message },
        { status: fetchError.code === 'PGRST116' ? 404 : 500 }
      );
    }

    if (!job) {
      return NextResponse.json(
        { error: 'Job not found' },
        { status: 404 }
      );
    }

    if (job.status !== 'running') {
      return NextResponse.json(
        { error: `Job is not running (current status: ${job.status})` },
        { status: 400 }
      );
    }

    // Mark job as failed with cancellation message
    const jobService = new BaseJobService(supabaseServer);
    await jobService.failJob(jobId, 'Job cancelled by user');

    return NextResponse.json({
      success: true,
      message: 'Job cancelled successfully',
    });
  } catch (error) {
    console.error('Error cancelling job:', error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'Unknown error occurred',
      },
      { status: 500 }
    );
  }
}
