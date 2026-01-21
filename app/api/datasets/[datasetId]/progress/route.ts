// API route to get pipeline progress for a dataset

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { supabaseServer } from '@/lib/supabase/server';
import type { Database } from '@/lib/supabase/supabase.types';

// Helper to create authenticated Supabase client for dataset verification
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

// Job type to stage mapping
const JOB_TYPE_TO_STAGE: Record<string, string> = {
  ebay_refresh_listings: 'capture',
  ebay_enrich_listings: 'enrich',
  ebay_materialize_listings: 'materialize',
  sanitize_listings: 'sanitize',
  reconcile: 'reconcile',
  analyze_listings: 'analyze',
};

// Pipeline stages in order
const PIPELINE_ORDER = [
  'ebay_refresh_listings',
  'ebay_enrich_listings',
  'ebay_materialize_listings',
  'sanitize_listings',
  'reconcile',
  'analyze_listings',
] as const;

// GET /api/datasets/[datasetId]/progress
export async function GET(
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

    // Query jobs table for all jobs with this dataset_id (not just completed)
    // Use supabaseServer to access pipeline schema (bypasses RLS)
    // Order by started_at DESC to get most recent jobs first
    const { data: jobs, error: jobsError } = await supabaseServer
      .schema('pipeline')
      .from('jobs')
      .select('type, status, started_at')
      .eq('dataset_id', datasetId)
      .order('started_at', { ascending: false });

    if (jobsError) {
      throw new Error(`Failed to query jobs: ${jobsError.message}`);
    }

    const datasetJobs = jobs || [];

    // Build a map of job type to status (taking the most recent job's status for each type)
    const jobStatusMap: Record<string, 'completed' | 'running' | 'failed'> = {};
    
    // Process jobs in order (most recent first) to get latest status for each type
    for (const job of datasetJobs) {
      if (!job.type) continue;
      
      // Only set status if we haven't seen this job type yet (since we're ordered by most recent first)
      if (!jobStatusMap[job.type]) {
        const currentStatus = job.status as 'completed' | 'running' | 'failed';
        if (currentStatus === 'completed' || currentStatus === 'running' || currentStatus === 'failed') {
          jobStatusMap[job.type] = currentStatus;
        }
      }
    }

    // Get completed stages for backward compatibility
    const completedStages = Object.entries(jobStatusMap)
      .filter(([_, status]) => status === 'completed')
      .map(([jobType]) => jobType);

    // Determine next stage
    let nextStage: string | null = null;
    for (const stageType of PIPELINE_ORDER) {
      if (!jobStatusMap[stageType] || jobStatusMap[stageType] !== 'completed') {
        nextStage = JOB_TYPE_TO_STAGE[stageType] || stageType;
        break;
      }
    }

    return NextResponse.json({
      completedStages,
      nextStage,
      jobStatuses: jobStatusMap, // New: map of job type to status
    });
  } catch (error) {
    console.error('Error fetching dataset progress:', error);
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
