// API route to trigger materialize listings job via Inngest

import { NextRequest, NextResponse } from 'next/server';
import { inngest } from '@/lib/inngest/client';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const {
      captureJobId,
      marketplace,
      datasetId,
    }: {
      captureJobId: string;
      marketplace: string;
      datasetId?: string;
    } = body;

    if (!captureJobId) {
      return NextResponse.json(
        { error: 'captureJobId is required' },
        { status: 400 }
      );
    }

    if (!marketplace) {
      return NextResponse.json(
        { error: 'marketplace is required' },
        { status: 400 }
      );
    }

    // Send Inngest event to trigger materialize job
    await inngest.send({
      name: 'job/materialize.triggered',
      data: {
        captureJobId,
        marketplace,
        datasetId,
      },
    });

    // Return immediately - job will be processed asynchronously by Inngest
    return NextResponse.json({
      status: 'running',
      message: 'Job started, check /api/jobs for status',
    });
  } catch (error) {
    console.error('Error triggering materialize job:', error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'Unknown error occurred',
      },
      { status: 500 }
    );
  }
}
