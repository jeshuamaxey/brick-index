// API route to get all jobs

import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';
import type { Database } from '@/lib/supabase/supabase.types';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const type = searchParams.get('type');
    const status = searchParams.get('status');
    const marketplace = searchParams.get('marketplace');
    const datasetId = searchParams.get('dataset_id');
    const limit = searchParams.get('limit');
    const offset = searchParams.get('offset');

    // Query jobs with dataset information via left join
    // We need to do a manual join since Supabase doesn't support cross-schema joins easily
    let query = supabaseServer
      .schema('pipeline')
      .from('jobs')
      .select('*', { count: 'exact' })
      .order('started_at', { ascending: false });

    // Apply filters
    if (type) {
      // Type assertion needed because query param is string, but DB expects enum
      query = query.eq('type', type as Database['pipeline']['Enums']['job_type']);
    }
    if (status) {
      query = query.eq('status', status);
    }
    if (marketplace) {
      query = query.eq('marketplace', marketplace);
    }
    if (datasetId) {
      query = query.eq('dataset_id', datasetId);
    }

    // Apply pagination
    if (limit) {
      const limitNum = parseInt(limit, 10);
      if (!isNaN(limitNum) && limitNum > 0) {
        query = query.limit(limitNum);
      }
    }
    if (offset) {
      const offsetNum = parseInt(offset, 10);
      if (!isNaN(offsetNum) && offsetNum >= 0) {
        query = query.range(offsetNum, offsetNum + (limit ? parseInt(limit, 10) - 1 : 99));
      }
    }

    const { data: jobs, error, count } = await query;

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    // Fetch dataset names for jobs that have dataset_id
    const datasetIds = new Set(
      (jobs || [])
        .map((job) => (job as { dataset_id?: string | null }).dataset_id)
        .filter((id): id is string => id !== null && id !== undefined)
    );

    const datasetMap = new Map<string, { id: string; name: string }>();

    if (datasetIds.size > 0) {
      // Fetch all datasets in one query
      const { data: datasets, error: datasetsError } = await supabaseServer
        .schema('public')
        .from('datasets')
        .select('id, name')
        .in('id', Array.from(datasetIds));

      if (!datasetsError && datasets) {
        datasets.forEach((dataset) => {
          datasetMap.set(dataset.id, dataset);
        });
      }
    }

    // Enrich jobs with dataset information
    const enrichedJobs = (jobs || []).map((job) => {
      const jobWithDataset = job as { dataset_id?: string | null; dataset?: { id: string; name: string } | null };
      const datasetId = jobWithDataset.dataset_id;
      if (datasetId && datasetMap.has(datasetId)) {
        return {
          ...job,
          dataset: datasetMap.get(datasetId)!,
        };
      }
      return job;
    });

    return NextResponse.json({
      jobs: enrichedJobs,
      count: count || 0,
    });
  } catch (error) {
    console.error('Error fetching jobs:', error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'Unknown error occurred',
      },
      { status: 500 }
    );
  }
}

