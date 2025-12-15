// API route to trigger a capture job

import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase/client';
import { CaptureService } from '@/lib/capture/capture-service';
import {
  EbayAdapter,
  type EbaySearchParams,
} from '@/lib/capture/marketplace-adapters/ebay-adapter';
import { EbaySnapshotAdapter } from '@/lib/capture/marketplace-adapters/ebay-snapshot-adapter';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      marketplace = 'ebay',
      keywords,
      ebayParams,
    }: {
      marketplace?: string;
      keywords?: string[];
      ebayParams?: EbaySearchParams;
    } = body;

    // Create adapter based on marketplace and EBAY_DATA_MODE
    let adapter;
    if (marketplace === 'ebay') {
      const ebayAppId = process.env.EBAY_APP_ID;
      const dataMode =
        process.env.EBAY_DATA_MODE ??
        (ebayAppId ? 'live' : 'mock');

      if (dataMode === 'cache') {
        // Use snapshot-based adapter that never calls the live eBay API.
        adapter = new EbaySnapshotAdapter();
      } else if (dataMode === 'mock') {
        const { MockAdapter } = await import(
          '@/lib/capture/marketplace-adapters/mock-adapter'
        );
        adapter = new MockAdapter();
      } else {
        if (!ebayAppId) {
          return NextResponse.json(
            {
              error:
                'EBAY_APP_ID is required when EBAY_DATA_MODE=live. Either set EBAY_DATA_MODE=cache|mock or provide EBAY_APP_ID.',
            },
            { status: 400 }
          );
        }
        // OAuth token will be fetched automatically by EbayAdapter
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
    
    // Pass eBay-specific params if provided
    const result = await captureService.captureFromMarketplace(
      adapter,
      searchKeywords,
      ebayParams
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

