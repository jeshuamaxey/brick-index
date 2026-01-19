// API route to trigger listing enrichment via Inngest

import { NextRequest, NextResponse } from 'next/server';
import { inngest } from '@/lib/inngest/client';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const {
      marketplace = 'ebay',
      captureJobId,
      limit,
      delayMs = 200,
    }: {
      marketplace?: string;
      captureJobId?: string;
      limit?: number;
      delayMs?: number;
    } = body;

    // Validate marketplace
    if (marketplace !== 'ebay') {
      return NextResponse.json(
        { error: `Unsupported marketplace: ${marketplace}` },
        { status: 400 }
      );
    }

    // Validate eBay configuration
    if (!process.env.EBAY_APP_ID) {
      return NextResponse.json(
        {
          error:
            'EBAY_APP_ID environment variable is required for enrichment',
        },
        { status: 400 }
      );
    }

    // Send Inngest event to trigger enrichment job
    await inngest.send({
      name: 'job/enrich.triggered',
      data: {
        marketplace,
        captureJobId,
        limit,
        delayMs,
      },
    });

    // Return immediately - job will be processed asynchronously by Inngest
    return NextResponse.json({
      status: 'running',
      message: 'Job started, check /api/jobs for status',
    });
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

