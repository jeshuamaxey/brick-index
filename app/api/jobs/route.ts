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
    const limit = searchParams.get('limit');
    const offset = searchParams.get('offset');

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

    const { data, error, count } = await query;

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      jobs: data || [],
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

