// API route to trigger the next job in the pipeline for a dataset

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { supabaseServer } from '@/lib/supabase/server';
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

// POST /api/datasets/[datasetId]/run-next-job
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

    // Get pipeline progress
    // Use supabaseServer to access pipeline schema (bypasses RLS)
    const { data: jobs, error: jobsError } = await supabaseServer
      .schema('pipeline')
      .from('jobs')
      .select('id, type, status, metadata, marketplace')
      .eq('status', 'completed')
      .eq('dataset_id', datasetId);

    if (jobsError) {
      throw new Error(`Failed to query jobs: ${jobsError.message}`);
    }

    const datasetJobs = jobs || [];

    // Get unique completed job types
    const completedJobTypes = new Set(
      datasetJobs.map((job) => job.type).filter(Boolean)
    );

    // Determine next stage
    let nextJobType: string | null = null;
    for (const stageType of PIPELINE_ORDER) {
      if (!completedJobTypes.has(stageType)) {
        nextJobType = stageType;
        break;
      }
    }

    if (!nextJobType) {
      return NextResponse.json(
        { error: 'All pipeline stages are complete for this dataset' },
        { status: 400 }
      );
    }

    // Trigger the appropriate job based on nextJobType
    let response: Response;
    let jobResponse: { status: string; message?: string; jobId?: string; error?: string };

    switch (nextJobType) {
      case 'ebay_refresh_listings': {
        // Capture requires keywords and marketplace - cannot auto-trigger
        return NextResponse.json(
          {
            error:
              'Capture job requires keywords and marketplace parameters. Please trigger it manually from the Capture page.',
            nextStage: 'capture',
          },
          { status: 400 }
        );
      }

      case 'ebay_enrich_listings': {
        // Enrich requires captureJobId - find the most recent capture job
        const captureJob = datasetJobs
          .filter((job) => job.type === 'ebay_refresh_listings')
          .sort((a, b) => {
            // Sort by id (which is time-based UUID) descending to get most recent
            return b.id.localeCompare(a.id);
          })[0];

        if (!captureJob) {
          return NextResponse.json(
            {
              error: 'No capture job found for this dataset. Please run capture first.',
            },
            { status: 400 }
          );
        }

        // Forward cookies from the original request to maintain authentication
        const cookieHeader = request.headers.get('cookie') || '';
        response = await fetch(`${request.nextUrl.origin}/api/capture/enrich`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Cookie': cookieHeader,
          },
          body: JSON.stringify({
            captureJobId: captureJob.id,
            marketplace: captureJob.marketplace || 'ebay',
            datasetId,
          }),
        });
        break;
      }

      case 'ebay_materialize_listings': {
        // Materialize requires captureJobId and marketplace
        const captureJob = datasetJobs
          .filter((job) => job.type === 'ebay_refresh_listings')
          .sort((a, b) => b.id.localeCompare(a.id))[0];

        if (!captureJob) {
          return NextResponse.json(
            {
              error: 'No capture job found for this dataset. Please run capture first.',
            },
            { status: 400 }
          );
        }

        // Forward cookies from the original request to maintain authentication
        const cookieHeader = request.headers.get('cookie') || '';
        response = await fetch(`${request.nextUrl.origin}/api/materialize/trigger`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Cookie': cookieHeader,
          },
          body: JSON.stringify({
            captureJobId: captureJob.id,
            marketplace: captureJob.marketplace || 'ebay',
            datasetId,
          }),
        });
        break;
      }

      case 'sanitize_listings': {
        // Forward cookies from the original request to maintain authentication
        const cookieHeader = request.headers.get('cookie') || '';
        response = await fetch(`${request.nextUrl.origin}/api/sanitize/trigger`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Cookie': cookieHeader,
          },
          body: JSON.stringify({
            datasetId,
          }),
        });
        break;
      }

      case 'reconcile': {
        // Forward cookies from the original request to maintain authentication
        const cookieHeader = request.headers.get('cookie') || '';
        response = await fetch(`${request.nextUrl.origin}/api/reconcile/trigger`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Cookie': cookieHeader,
          },
          body: JSON.stringify({
            datasetId,
          }),
        });
        break;
      }

      case 'analyze_listings': {
        // Forward cookies from the original request to maintain authentication
        const cookieHeader = request.headers.get('cookie') || '';
        response = await fetch(`${request.nextUrl.origin}/api/analyze/trigger`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Cookie': cookieHeader,
          },
          body: JSON.stringify({
            datasetId,
          }),
        });
        break;
      }

      default:
        return NextResponse.json(
          { error: `Unknown job type: ${nextJobType}` },
          { status: 400 }
        );
    }

    jobResponse = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        {
          error: jobResponse.error || 'Failed to trigger job',
          nextStage: nextJobType,
        },
        { status: response.status }
      );
    }

    return NextResponse.json({
      status: 'running',
      message: 'Job started, check /api/jobs for status',
      nextStage: nextJobType,
    });
  } catch (error) {
    console.error('Error triggering next job:', error);
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
