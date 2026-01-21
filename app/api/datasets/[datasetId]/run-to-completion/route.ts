// API route to trigger running the entire pipeline to completion for a dataset

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { supabaseServer } from '@/lib/supabase/server';
import { inngest } from '@/lib/inngest/client';
import type { Database } from '@/lib/supabase/supabase.types';

// Helper to create authenticated Supabase client
async function getAuthenticatedClient() {
  const cookieStore = await cookies();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Supabase configuration missing');
  }

  const supabase = createServerClient<Database>(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll() {
          // Not needed for reading auth state
        },
      },
    }
  );

  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) {
    throw new Error('Authentication required');
  }

  return { supabase, user };
}

// Pipeline stages in order
const PIPELINE_ORDER = [
  'ebay_refresh_listings',
  'ebay_enrich_listings',
  'ebay_materialize_listings',
  'sanitize_listings',
  'reconcile',
  'analyze_listings',
] as const;

// POST /api/datasets/[datasetId]/run-to-completion
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ datasetId: string }> }
) {
  try {
    const { datasetId } = await context.params;
    const { supabase, user } = await getAuthenticatedClient();

    // Verify dataset belongs to user
    const { data: dataset, error: datasetError } = await supabase
      .schema('public')
      .from('datasets')
      .select('id')
      .eq('id', datasetId)
      .eq('user_id', user.id)
      .single();

    if (datasetError || !dataset) {
      return NextResponse.json(
        { error: 'Dataset not found or access denied' },
        { status: 404 }
      );
    }

    // Get pipeline progress - check completed jobs
    const { data: jobs, error: jobsError } = await supabaseServer
      .schema('pipeline')
      .from('jobs')
      .select('id, type, status, marketplace')
      .eq('dataset_id', datasetId);

    if (jobsError) {
      throw new Error(`Failed to query jobs: ${jobsError.message}`);
    }

    const datasetJobs = jobs || [];

    // Check for running jobs - don't allow starting if a job is already running
    const runningJob = datasetJobs.find((job) => job.status === 'running');
    if (runningJob) {
      return NextResponse.json(
        { 
          error: 'A job is already running for this dataset. Please wait for it to complete or cancel it.',
          runningJobType: runningJob.type,
        },
        { status: 409 }
      );
    }

    // Get completed job types
    const completedJobTypes = new Set(
      datasetJobs
        .filter((job) => job.status === 'completed')
        .map((job) => job.type)
        .filter(Boolean)
    );

    // Verify capture job is complete (required before running to completion)
    if (!completedJobTypes.has('ebay_refresh_listings')) {
      return NextResponse.json(
        { 
          error: 'Capture job must be completed before running to completion. Please run capture first from the Capture page.',
          nextStage: 'capture',
        },
        { status: 400 }
      );
    }

    // Check if all stages are already complete
    const remainingStages = PIPELINE_ORDER.filter(
      (stage) => !completedJobTypes.has(stage)
    );

    if (remainingStages.length === 0) {
      return NextResponse.json(
        { error: 'All pipeline stages are already complete for this dataset' },
        { status: 400 }
      );
    }

    // Get marketplace from capture job
    const captureJob = datasetJobs.find(
      (job) => job.type === 'ebay_refresh_listings' && job.status === 'completed'
    );
    const marketplace = captureJob?.marketplace || 'ebay';

    // Send event to Inngest to trigger the pipeline orchestrator
    await inngest.send({
      name: 'pipeline/run-to-completion',
      data: {
        datasetId,
        completedStages: Array.from(completedJobTypes),
        marketplace,
      },
    });

    return NextResponse.json({
      status: 'running',
      message: 'Pipeline started. All remaining jobs will run sequentially.',
      remainingStages,
      stagesCount: remainingStages.length,
    });
  } catch (error) {
    console.error('Error triggering run-to-completion:', error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'Unknown error occurred',
      },
      {
        status:
          error instanceof Error && error.message === 'Authentication required'
            ? 401
            : 500,
      }
    );
  }
}
