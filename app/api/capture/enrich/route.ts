// API route to trigger listing enrichment

import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase/client';
import { EnrichmentService } from '@/lib/capture/enrichment-service';
import { EbayAdapter } from '@/lib/capture/marketplace-adapters/ebay-adapter';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const {
      marketplace = 'ebay',
      limit,
      delayMs = 200,
    }: {
      marketplace?: string;
      limit?: number;
      delayMs?: number;
    } = body;

    // Create adapter based on marketplace
    let adapter;
    if (marketplace === 'ebay') {
      const ebayAppId = process.env.EBAY_APP_ID;
      if (!ebayAppId) {
        return NextResponse.json(
          {
            error:
              'EBAY_APP_ID environment variable is required for enrichment',
          },
          { status: 400 }
        );
      }
      adapter = new EbayAdapter(ebayAppId);
    } else {
      return NextResponse.json(
        { error: `Unsupported marketplace: ${marketplace}` },
        { status: 400 }
      );
    }

    // Create enrichment service and run enrichment
    const enrichmentService = new EnrichmentService(supabase);
    const result = await enrichmentService.enrichListings(adapter, {
      marketplace,
      limit,
      delayMs,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error enriching listings:', error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'Unknown error occurred',
      },
      { status: 500 }
    );
  }
}

