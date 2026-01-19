// API route to trigger reconcile job via Inngest

import { NextRequest, NextResponse } from 'next/server';
import { inngest } from '@/lib/inngest/client';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const {
      listingIds,
      limit,
      reconciliationVersion,
      cleanupMode,
      rerun,
    }: {
      listingIds?: string[];
      limit?: number;
      reconciliationVersion?: string;
      cleanupMode?: 'delete' | 'supersede' | 'keep';
      rerun?: boolean;
    } = body;

    // Send Inngest event to trigger reconcile job
    await inngest.send({
      name: 'job/reconcile.triggered',
      data: {
        listingIds,
        limit,
        reconciliationVersion,
        cleanupMode,
        rerun,
      },
    });

    // Return immediately - job will be processed asynchronously by Inngest
    return NextResponse.json({
      status: 'running',
      message: 'Job started, check /api/jobs for status',
    });
  } catch (error) {
    console.error('Error triggering reconcile:', error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'Unknown error occurred',
      },
      { status: 500 }
    );
  }
}
