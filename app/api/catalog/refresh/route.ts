// API route to trigger a catalog refresh job via Inngest

import { NextResponse } from 'next/server';
import { inngest } from '@/lib/inngest/client';

export async function POST() {
  try {
    // Send event to Inngest to trigger the catalog refresh job
    await inngest.send({
      name: 'job/catalog-refresh.triggered',
      data: {},
    });

    // Return immediately - job will be created and managed by Inngest
    return NextResponse.json({
      status: 'queued',
      message: 'Catalog refresh job queued',
    });
  } catch (error) {
    console.error('Error triggering catalog refresh:', error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'Unknown error occurred',
      },
      { status: 500 }
    );
  }
}
