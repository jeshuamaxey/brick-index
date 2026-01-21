// API endpoint to get details of a specific published LEGO set
// Public: Returns set metadata for all users
// Authenticated: Also includes pricing data

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

    // Check authentication status
    const { isAuthenticated } = await getAuthStatus();

    // Get the set from the database
    const { data: set, error: setError } = await supabaseServer
      .schema('catalog')
      .from('lego_sets')
      .select('*')
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

    // Get the theme name if available
    let themeName: string | null = null;
    if (set.theme_id) {
      const { data: theme } = await supabaseServer
        .schema('catalog')
        .from('themes')
        .select('name')
        .eq('id', set.theme_id)
        .single();
      themeName = theme?.name || null;
    }

    // If authenticated, include pricing data
    let pricing = null;
    if (isAuthenticated) {
      const priceService = new PriceAggregationService(supabaseServer);
      pricing = await priceService.getSetPriceAggregate(set.id);
      
      // Debug logging
      if (!pricing) {
        console.log(`[DEBUG] No pricing found for set ${setNum} (id: ${set.id})`);
        
        // Check if the view has any data for this set
        const { data: viewData, error: viewError } = await supabaseServer
          .schema('analytics')
          .from('set_price_aggregates')
          .select('*')
          .eq('set_num', setNum)
          .single();
        
        if (viewError) {
          console.log(`[DEBUG] View query error: ${viewError.code} - ${viewError.message}`);
        } else {
          console.log(`[DEBUG] View data by set_num:`, viewData);
        }
      }
    }

    return NextResponse.json({
      set: {
        id: set.id,
        setNum: set.set_num,
        name: set.name,
        year: set.year,
        themeId: set.theme_id,
        themeName,
        numParts: set.num_parts,
        setImgUrl: set.set_img_url,
        setUrl: set.set_url,
      },
      pricing,
      isAuthenticated,
    });
  } catch (error) {
    console.error('Error fetching set details:', error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'Unknown error occurred',
      },
      { status: 500 }
    );
  }
}
