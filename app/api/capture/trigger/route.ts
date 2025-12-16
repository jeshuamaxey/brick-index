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
      const dataMode = process.env.EBAY_DATA_MODE ?? 'live';

      if (dataMode === 'cache') {
        // Use snapshot-based adapter that never calls the live eBay API.
        adapter = new EbaySnapshotAdapter();
      } else {
        if (!ebayAppId) {
          return NextResponse.json(
            {
              error:
                'EBAY_APP_ID is required when EBAY_DATA_MODE=live. Either set EBAY_DATA_MODE=cache or provide EBAY_APP_ID.',
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

    // Create capture service and start capture job
    const captureService = new CaptureService(supabase);
    const searchKeywords = keywords || ['lego bulk', 'lego job lot', 'lego lot'];
    
    try {
      // Start the job (it will create the job resource internally)
      // Job creation happens synchronously, so we can catch errors immediately
      const jobPromise = captureService.captureFromMarketplace(
        adapter,
        searchKeywords,
        ebayParams
      );

      // Wait just long enough to get the job ID (job is created synchronously at start)
      // If job creation fails, this will throw and be caught below
      const jobIdPromise = jobPromise.then((job) => job.id);
      
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

