// API route to get eBay API usage statistics

import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase/client';
import { EbayApiUsageTracker } from '@/lib/ebay/api-usage-tracker';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const appId = searchParams.get('appId') || process.env.EBAY_APP_ID;
    const hours = parseInt(searchParams.get('hours') || '24', 10);

    if (!appId) {
      return NextResponse.json(
        { error: 'eBay App ID is required. Provide appId query parameter or set EBAY_APP_ID environment variable.' },
        { status: 400 }
      );
    }

    const tracker = new EbayApiUsageTracker(supabase);
    const stats = await tracker.getUsageStats(appId, hours);

    return NextResponse.json({
      app_id: appId,
      hours,
      stats,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error fetching eBay API usage:', error);
    return NextResponse.json(
      { error: 'Failed to fetch API usage statistics' },
      { status: 500 }
    );
  }
}
