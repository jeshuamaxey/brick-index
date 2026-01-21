// Admin API endpoint to refresh the price aggregates materialized view
// Requires backend.manage permission

import { NextResponse } from 'next/server';
import { requirePermission } from '@/lib/auth/auth-helpers';
import { supabaseServer } from '@/lib/supabase/server';
import { PriceAggregationService } from '@/lib/pricing/price-aggregation-service';

/**
 * POST - Refresh the set_price_aggregates materialized view
 */
export async function POST() {
  try {
    // Check permission
    await requirePermission('backend.manage');

    const priceService = new PriceAggregationService(supabaseServer);
    await priceService.refreshMaterializedView();

    return NextResponse.json({
      success: true,
      message: 'Materialized view refreshed successfully',
    });
  } catch (error) {
    console.error('Error refreshing materialized view:', error);

    if (error instanceof Error && error.message.includes('Permission required')) {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
    }
    if (error instanceof Error && error.message.includes('Authentication required')) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
