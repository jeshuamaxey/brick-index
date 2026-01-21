// API endpoint to get price history for a specific LEGO set
// Requires authentication

import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';
import { getAuthStatus } from '@/lib/auth/api-auth';
import { PublishingService } from '@/lib/publishing/publishing-service';
import { PriceAggregationService } from '@/lib/pricing/price-aggregation-service';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ setNum: string }> }
) {
  try {
    const { setNum } = await params;

    // Check authentication status - this endpoint requires auth
    const { isAuthenticated } = await getAuthStatus();

    if (!isAuthenticated) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Get the set from the database
    const { data: set, error: setError } = await supabaseServer
      .schema('catalog')
      .from('lego_sets')
      .select('id')
      .eq('set_num', setNum)
      .single();

    if (setError || !set) {
      return NextResponse.json(
        { error: 'Set not found' },
        { status: 404 }
      );
    }

    // Check if the set is published
    const publishingService = new PublishingService(supabaseServer);
    const isPublished = await publishingService.isSetPublished(set.id);

    if (!isPublished) {
      return NextResponse.json(
        { error: 'Set not found' },
        { status: 404 }
      );
    }

    // Get query parameters
    const url = new URL(request.url);
    const daysParam = url.searchParams.get('days');
    const aggregation = url.searchParams.get('aggregation') || 'daily';
    
    const days = daysParam ? parseInt(daysParam, 10) : 90;
    if (isNaN(days) || days < 1 || days > 365) {
      return NextResponse.json(
        { error: 'Invalid days parameter. Must be between 1 and 365.' },
        { status: 400 }
      );
    }

    // Get price history
    const priceService = new PriceAggregationService(supabaseServer);
    
    let history;
    if (aggregation === 'weekly') {
      const weeks = Math.ceil(days / 7);
      history = await priceService.getWeeklyPriceHistory(setNum, weeks);
    } else {
      history = await priceService.getPriceHistory(setNum, days);
    }

    return NextResponse.json({
      setNum,
      aggregation,
      days,
      history,
    });
  } catch (error) {
    console.error('Error fetching price history:', error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'Unknown error occurred',
      },
      { status: 500 }
    );
  }
}
