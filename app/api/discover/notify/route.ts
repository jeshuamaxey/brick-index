// API route to process notifications (matching and email sending)

import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';
import { NotificationService } from '@/lib/discover/notification-service';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { listingIds } = body;

    // Use server-side Supabase client with service role for admin access
    const notificationService = new NotificationService(supabaseServer);
    const emailsSent = await notificationService.processNotifications(
      listingIds
    );

    return NextResponse.json({
      success: true,
      emailsSent,
    });
  } catch (error) {
    console.error('Error processing notifications:', error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'Unknown error occurred',
      },
      { status: 500 }
    );
  }
}

