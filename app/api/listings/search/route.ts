// API route to search listings

import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);
    const status = searchParams.get('status');
    const jobId = searchParams.get('job_id');
    const marketplace = searchParams.get('marketplace');
    const enriched = searchParams.get('enriched'); // 'true' or 'false' as string

    // Build base query for counting total
    let countQuery = supabaseServer
      .schema('pipeline')
      .from('listings')
      .select('*', { count: 'exact', head: true });

    // Build query for fetching data
    let query = supabaseServer
      .schema('pipeline')
      .from('listings')
      .select('*, listing_analysis(*)');

    // Apply filters
    if (status) {
      query = query.eq('status', status);
      countQuery = countQuery.eq('status', status);
    }

    if (jobId) {
      query = query.eq('job_id', jobId);
      countQuery = countQuery.eq('job_id', jobId);
    }

    if (marketplace) {
      query = query.eq('marketplace', marketplace);
      countQuery = countQuery.eq('marketplace', marketplace);
    }

    if (enriched === 'true') {
      query = query.not('enriched_at', 'is', null);
      countQuery = countQuery.not('enriched_at', 'is', null);
    } else if (enriched === 'false') {
      query = query.is('enriched_at', null);
      countQuery = countQuery.is('enriched_at', null);
    }

    // Get total count
    const { count, error: countError } = await countQuery;

    if (countError) {
      return NextResponse.json(
        { error: countError.message },
        { status: 500 }
      );
    }

    // Apply ordering and pagination
    query = query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    const { data, error } = await query;

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      listings: data || [],
      total: count || 0,
      limit,
      offset,
    });
  } catch (error) {
    console.error('Error searching listings:', error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'Unknown error occurred',
      },
      { status: 500 }
    );
  }
}

