// API route to trigger a capture job

import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase/client';
import { CaptureService } from '@/lib/capture/capture-service';
import { EbayAdapter } from '@/lib/capture/marketplace-adapters/ebay-adapter';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { marketplace = 'ebay', keywords } = body;

    // Create adapter based on marketplace
    let adapter;
    if (marketplace === 'ebay') {
      const ebayAppId = process.env.EBAY_APP_ID;
      if (!ebayAppId) {
        // Use mock adapter if no eBay App ID (for testing without API access)
        const { MockAdapter } = await import(
          '@/lib/capture/marketplace-adapters/mock-adapter'
        );
        adapter = new MockAdapter();
      } else {
        adapter = new EbayAdapter(ebayAppId);
      }
    } else {
      return NextResponse.json(
        { error: `Unsupported marketplace: ${marketplace}` },
        { status: 400 }
      );
    }

    // Create capture service and run capture
    const captureService = new CaptureService(supabase);
    const searchKeywords = keywords || ['lego bulk', 'lego job lot', 'lego lot'];
    const result = await captureService.captureFromMarketplace(
      adapter,
      searchKeywords
    );

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error triggering capture:', error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'Unknown error occurred',
      },
      { status: 500 }
    );
  }
}

