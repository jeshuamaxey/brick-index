// API route to trigger analysis for a specific listing

import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase/client';
import { AnalysisService } from '@/lib/analyze/analysis-service';

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ listingId: string }> }
) {
  try {
    const { listingId } = await context.params;

    const analysisService = new AnalysisService(supabase);
    const result = await analysisService.analyzeListing(listingId);

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error analyzing listing:', error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'Unknown error occurred',
      },
      { status: 500 }
    );
  }
}

