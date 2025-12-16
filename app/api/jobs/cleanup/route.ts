// API route to cleanup stale jobs

import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';
import { JobCleanupService } from '@/lib/jobs/job-cleanup-service';

export async function POST(request: NextRequest) {
  try {
    // Optional: Add authentication/authorization check here
    // For now, we'll allow it but you may want to add API key or auth check
    
    const body = await request.json().catch(() => ({}));
    const { useApplicationLevel = false } = body as {
      useApplicationLevel?: boolean;
    };

    const cleanupService = new JobCleanupService(supabaseServer);

    let result;
    if (useApplicationLevel) {
      // Use application-level cleanup (fallback method)
      result = await cleanupService.cleanupStaleJobsApplicationLevel();
    } else {
      // Use database function (preferred method)
      try {
        result = await cleanupService.cleanupStaleJobs();
      } catch (error) {
        // If database function fails, fall back to application-level
        console.warn('Database function failed, falling back to application-level cleanup:', error);
        try {
          result = await cleanupService.cleanupStaleJobsApplicationLevel();
        } catch (fallbackError) {
          // If both fail, throw the original error
          throw error;
        }
      }
    }

    return NextResponse.json({
      success: true,
      jobsUpdated: result.jobsUpdated,
      jobIds: result.jobIds,
      message: `Marked ${result.jobsUpdated} stale job(s) as timed out`,
    });
  } catch (error) {
    console.error('Error cleaning up stale jobs:', error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : 'Unknown error occurred',
      },
      { status: 500 }
    );
  }
}

// GET endpoint for stats (useful for monitoring)
export async function GET() {
  try {
    const cleanupService = new JobCleanupService(supabaseServer);
    const stats = await cleanupService.getStaleJobStats();

    return NextResponse.json({
      success: true,
      stats,
    });
  } catch (error) {
    console.error('Error getting stale job stats:', error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : 'Unknown error occurred',
      },
      { status: 500 }
    );
  }
}
