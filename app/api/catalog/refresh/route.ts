// API route to trigger a catalog refresh job

import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';
import { LegoCatalogService } from '@/lib/catalog/lego-catalog-service';
import { BaseJobService } from '@/lib/jobs/base-job-service';

export async function POST(request: NextRequest) {
  try {
    // Create catalog service and job service
    const catalogService = new LegoCatalogService(supabaseServer);
    const jobService = new BaseJobService(supabaseServer);

    try {
      // Create job record
      const job = await jobService.createJob(
        'lego_catalog_refresh',
        'rebrickable',
        {}
      );

      const jobId = job.id;

      // Start the refresh asynchronously (don't await)
      catalogService.refreshCatalog(jobId).catch((error) => {
        // Error handling is done in the service, but log here for visibility
        console.error('Catalog refresh job failed:', error);
      });

      // Return job info immediately
      return NextResponse.json({
        jobId,
        status: 'running',
        message: 'Catalog refresh job started',
      });
    } catch (error) {
      // Catch errors that happen during job creation (synchronous errors)
      throw error;
    }
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
