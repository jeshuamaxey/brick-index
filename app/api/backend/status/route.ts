// API route to get status information for backend actions page

import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';
import type { Database } from '@/lib/supabase/supabase.types';

export async function GET() {
  try {
    // Get last successful capture job
    const { data: captureJobs } = await supabaseServer
      .schema('pipeline')
      .from('jobs')
      .select('completed_at')
      .eq('type', 'refresh' as Database['pipeline']['Enums']['job_type'])
      .eq('status', 'completed')
      .order('completed_at', { ascending: false })
      .limit(1);
    
    const lastCaptureJob = captureJobs && captureJobs.length > 0 ? captureJobs[0] : null;

    // Get listing counts for enrichment
    const { count: totalListings } = await supabaseServer
      .schema('pipeline')
      .from('listings')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'active');

    const { count: unenrichedListings } = await supabaseServer
      .schema('pipeline')
      .from('listings')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'active')
      .is('enriched_at', null);

    // Get listing counts for analysis
    const { data: listingsWithAnalysis } = await supabaseServer
      .schema('pipeline')
      .from('listings')
      .select('id, listing_analysis(id)')
      .eq('status', 'active');

    const totalForAnalysis = listingsWithAnalysis?.length || 0;
    const unanalyzedListings = listingsWithAnalysis?.filter(
      (l) => !l.listing_analysis || l.listing_analysis.length === 0
    ).length || 0;

    return NextResponse.json({
      lastCaptureJob: lastCaptureJob?.completed_at || null,
      enrichment: {
        total: totalListings || 0,
        unenriched: unenrichedListings || 0,
      },
      analysis: {
        total: totalForAnalysis,
        unanalyzed: unanalyzedListings,
      },
    });
  } catch (error) {
    console.error('Error fetching status:', error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'Unknown error occurred',
      },
      { status: 500 }
    );
  }
}

