// API route to get job status

import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase/client';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ jobId: string }> }
) {
  try {
    const { jobId } = await context.params;

    const { data, error } = await supabase
      .schema('pipeline')
      .from('jobs')
      .select('*')
      .eq('id', jobId)
      .single();

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: error.code === 'PGRST116' ? 404 : 500 }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching job status:', error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'Unknown error occurred',
      },
      { status: 500 }
    );
  }
}

