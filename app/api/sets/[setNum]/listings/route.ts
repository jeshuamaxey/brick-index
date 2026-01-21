import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';
import { getAuthStatus } from '@/lib/auth/api-auth';

interface RouteParams {
  params: Promise<{ setNum: string }>;
}

/**
 * GET - Get active listings for a specific LEGO set
 * Requires authentication to view listing data
 */
export async function GET(request: Request, { params }: RouteParams) {
  try {
    const { setNum } = await params;
    
    // Check authentication - listings require auth
    const { isAuthenticated } = await getAuthStatus();
    
    if (!isAuthenticated) {
      return NextResponse.json(
        { error: 'Authentication required to view listings' },
        { status: 401 }
      );
    }

    // First get the lego_set_id from set_num
    const { data: legoSet, error: setError } = await supabaseServer
      .schema('catalog')
      .from('lego_sets')
      .select('id')
      .eq('set_num', setNum)
      .single();

    if (setError || !legoSet) {
      return NextResponse.json(
        { error: 'Set not found' },
        { status: 404 }
      );
    }

    // Get active listings for this set
    const { data: joins, error: joinsError } = await supabaseServer
      .schema('pipeline')
      .from('listing_lego_set_joins')
      .select(`
        listing_id,
        nature,
        listings:listing_id (
          id,
          marketplace,
          title,
          sanitised_title,
          price,
          currency,
          url,
          condition_description,
          last_seen_at
        )
      `)
      .eq('lego_set_id', legoSet.id)
      .eq('status', 'active');

    if (joinsError) {
      console.error('Error fetching listings:', joinsError);
      return NextResponse.json(
        { error: 'Failed to fetch listings' },
        { status: 500 }
      );
    }

    // Transform the data to flatten the listing info
    const listings = (joins || [])
      .filter((join) => join.listings)
      .map((join) => {
        const listing = join.listings as {
          id: string;
          marketplace: string;
          title: string;
          sanitised_title: string | null;
          price: number | null;
          currency: string | null;
          url: string;
          condition_description: string | null;
          last_seen_at: string | null;
        };
        
        return {
          id: listing.id,
          marketplace: listing.marketplace,
          title: listing.sanitised_title || listing.title,
          price: listing.price,
          currency: listing.currency || 'USD',
          url: listing.url,
          condition: listing.condition_description,
          lastSeenAt: listing.last_seen_at,
          nature: join.nature,
        };
      })
      // Sort by price ascending (cheapest first)
      .sort((a, b) => (a.price ?? Infinity) - (b.price ?? Infinity));

    return NextResponse.json({
      listings,
      total: listings.length,
    });
  } catch (error) {
    console.error('Error in GET /api/sets/[setNum]/listings:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
