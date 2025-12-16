// API route to trigger batch analysis job

import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase/client';
import { AnalysisService } from '@/lib/analyze/analysis-service';

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

    // Create analysis service and start analysis job
    const analysisService = new AnalysisService(supabase);
    
    try {
      // Start the job (it will create the job resource internally)
      // Job creation happens synchronously, so we can catch errors immediately
      const jobPromise = analysisService.analyzeListingsWithJob(listingIds, limit);

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
