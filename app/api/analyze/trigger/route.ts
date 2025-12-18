// API route to trigger batch analysis job via Inngest

import { NextRequest, NextResponse } from 'next/server';
import { inngest } from '@/lib/inngest/client';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const {
      listingIds,
      limit,
    }: {
      listingIds?: string[];
      limit?: number;
    } = body;

    // Send Inngest event to trigger analysis job
    await inngest.send({
      name: 'job/analyze.triggered',
      data: {
        listingIds,
        limit,
      },
    });

    // Return immediately - job will be processed asynchronously by Inngest
    return NextResponse.json({
      status: 'running',
      message: 'Job started, check /api/jobs for status',
    });
  } catch (error) {
    console.error('Error triggering analysis:', error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'Unknown error occurred',
      },
      { status: 500 }
    );
  }
}
