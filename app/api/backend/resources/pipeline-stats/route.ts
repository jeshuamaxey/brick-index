// API route to get pipeline statistics for data visualization

import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';

export async function GET() {
  try {
    // Query 1: Count raw listings (output of capture jobs)
    const { count: rawListingsCount, error: rawListingsError } = await supabaseServer
      .schema('pipeline')
      .from('raw_listings')
      .select('*', { count: 'exact', head: true });

    if (rawListingsError) {
      throw new Error(`Failed to count raw listings: ${rawListingsError.message}`);
    }

    // Query 2: Count all listings (output of materialize jobs)
    const { count: listingsCount, error: listingsError } = await supabaseServer
      .schema('pipeline')
      .from('listings')
      .select('*', { count: 'exact', head: true });

    if (listingsError) {
      throw new Error(`Failed to count listings: ${listingsError.message}`);
    }

    // Query 3: Count enriched listings (where enriched_at IS NOT NULL)
    const { count: enrichedListingsCount, error: enrichedListingsError } = await supabaseServer
      .schema('pipeline')
      .from('listings')
      .select('*', { count: 'exact', head: true })
      .not('enriched_at', 'is', null);

    if (enrichedListingsError) {
      throw new Error(`Failed to count enriched listings: ${enrichedListingsError.message}`);
    }

    // Query 4: Count analyzed listings (distinct listing_ids in listing_analysis)
    // We'll count distinct listing_ids to get the number of unique listings that have been analyzed
    const { data: analyzedListingsData, error: analyzedListingsError } = await supabaseServer
      .schema('pipeline')
      .from('listing_analysis')
      .select('listing_id');

    if (analyzedListingsError) {
      throw new Error(`Failed to count analyzed listings: ${analyzedListingsError.message}`);
    }

    // Count distinct listing_ids
    const analyzedListingsCount = analyzedListingsData
      ? new Set(analyzedListingsData.map((item) => item.listing_id)).size
      : 0;

    return NextResponse.json({
      rawListings: rawListingsCount || 0,
      listings: listingsCount || 0,
      enrichedListings: enrichedListingsCount || 0,
      analyzedListings: analyzedListingsCount,
    });
  } catch (error) {
    console.error('Error fetching pipeline stats:', error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'Unknown error occurred',
      },
      { status: 500 }
    );
  }
}



