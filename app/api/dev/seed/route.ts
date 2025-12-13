// API route to seed test data (for development without eBay API)

import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase/client';
import { CaptureService } from '@/lib/capture/capture-service';
import { MockAdapter } from '@/lib/capture/marketplace-adapters/mock-adapter';
import { AnalysisService } from '@/lib/analyze/analysis-service';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action = 'all' } = body;

    const results: Record<string, unknown> = {};

    // Seed listings using mock adapter
    if (action === 'listings' || action === 'all') {
      const mockAdapter = new MockAdapter();
      const captureService = new CaptureService(supabase);
      const captureResult = await captureService.captureFromMarketplace(
        mockAdapter,
        ['lego bulk', 'lego job lot']
      );
      results.capture = captureResult;
    }

    // Analyze all listings
    if (action === 'analyze' || action === 'all') {
      const analysisService = new AnalysisService(supabase);
      const analyzedCount = await analysisService.analyzeUnanalyzedListings(
        100
      );
      results.analyzed = analyzedCount;
    }

    return NextResponse.json({
      success: true,
      message: 'Test data seeded successfully',
      results,
    });
  } catch (error) {
    console.error('Error seeding test data:', error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'Unknown error occurred',
      },
      { status: 500 }
    );
  }
}

