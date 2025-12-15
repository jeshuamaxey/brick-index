// API route to analyze listings (for development)

import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase/client';
import { AnalysisService } from '@/lib/analyze/analysis-service';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action = 'analyze' } = body;

    const results: Record<string, unknown> = {};

    // Analyze all listings
    if (action === 'analyze') {
      const analysisService = new AnalysisService(supabase);
      const analyzedCount = await analysisService.analyzeUnanalyzedListings(
        100
      );
      results.analyzed = analyzedCount;
    } else {
      return NextResponse.json(
        {
          error: `Unknown action: ${action}. Supported action: 'analyze'`,
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Analysis completed successfully',
      results,
    });
  } catch (error) {
    console.error('Error analyzing listings:', error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'Unknown error occurred',
      },
      { status: 500 }
    );
  }
}

