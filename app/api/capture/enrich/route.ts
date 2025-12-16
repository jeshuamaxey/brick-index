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
      // OAuth token will be fetched automatically by EbayAdapter
      adapter = new EbayAdapter(ebayAppId);
    } else {
      return NextResponse.json(
        { error: `Unsupported marketplace: ${marketplace}` },
        { status: 400 }
      );
    }

    // Create enrichment service and start enrichment job
    const enrichmentService = new EnrichmentService(supabase);
    
    try {
      // Start the job (it will create the job resource internally)
      // Job creation happens synchronously, so we can catch errors immediately
      const jobPromise = enrichmentService.enrichListings(adapter, {
        marketplace,
        limit,
        delayMs,
      });

      // Wait just long enough to get the job ID (job is created synchronously at start)
      // If job creation fails, this will throw and be caught below
      const jobIdPromise = jobPromise.then((result) => result.jobId);
      
      // Race between getting job ID and a small timeout
      // Use a longer timeout to ensure job creation completes
      const jobId = await Promise.race([
        jobIdPromise,
        new Promise<string | null>((resolve) => 
          setTimeout(() => resolve(null), 500)
        ),
      ]);

      if (!jobId) {
        // If we couldn't get job ID quickly, still return - job is running
        return NextResponse.json({
          status: 'running',
          message: 'Job started, check /api/jobs for status',
        });
      }

      // Return job info immediately
      return NextResponse.json({
        jobId,
        status: 'running',
      });
    } catch (error) {
      // Catch errors that happen during job creation (synchronous errors)
      // Errors during execution are handled by the service and won't be caught here
      throw error;
    }
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

