// API route to trigger a capture job via Inngest

import { NextRequest, NextResponse } from 'next/server';
import { inngest } from '@/lib/inngest/client';
import type { EbaySearchParams } from '@/lib/capture/marketplace-adapters/ebay-adapter';

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

    // Validate keywords (required)
    if (!keywords || !Array.isArray(keywords) || keywords.length === 0) {
      return NextResponse.json(
        { error: 'keywords is required and must be a non-empty array' },
        { status: 400 }
      );
    }

    // Validate marketplace
    if (marketplace !== 'ebay') {
      return NextResponse.json(
        { error: `Unsupported marketplace: ${marketplace}` },
        { status: 400 }
      );
    }

    // Validate eBay configuration if needed
    const dataMode = process.env.EBAY_DATA_MODE ?? 'live';
    if (dataMode === 'live' && !process.env.EBAY_APP_ID) {
      return NextResponse.json(
        {
          error:
            'EBAY_APP_ID is required when EBAY_DATA_MODE=live. Either set EBAY_DATA_MODE=cache or provide EBAY_APP_ID.',
        },
        { status: 400 }
      );
    }

    // Send Inngest event to trigger capture job
    
    await inngest.send({
      name: 'job/capture.triggered',
      data: {
        marketplace,
        keywords,
        ebayParams,
      },
    });

    // Return immediately - job will be processed asynchronously by Inngest
    return NextResponse.json({
      status: 'running',
      message: 'Job started, check /api/jobs for status',
    });
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

