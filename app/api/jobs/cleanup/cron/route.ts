// Cron endpoint for cleaning up stale jobs
// This endpoint is designed to be called by Vercel Cron (runs once per day at midnight UTC)

import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';
import { JobCleanupService } from '@/lib/jobs/job-cleanup-service';

export const runtime = 'nodejs';
export const maxDuration = 30; // 30 seconds max for cron job

export async function GET(request: NextRequest) {
  try {
    // Verify this is a cron request (optional security check)
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const cleanupService = new JobCleanupService(supabaseServer);
    
    // Use database function (preferred method)
    const result = await cleanupService.cleanupStaleJobs();

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      jobsUpdated: result.jobsUpdated,
      jobIds: result.jobIds,
      message: `Marked ${result.jobsUpdated} stale job(s) as timed out`,
    });
  } catch (error) {
    console.error('Error in cron cleanup:', error);
    return NextResponse.json(
      {
        success: false,
        timestamp: new Date().toISOString(),
        error:
          error instanceof Error ? error.message : 'Unknown error occurred',
      },
      { status: 500 }
    );
  }
}
