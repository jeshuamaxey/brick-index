// API route to get listing details

import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase/client';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;

    // Fetch listing with analysis
    const { data: listing, error: listingError } = await supabase
      .schema('pipeline')
      .from('listings')
      .select('*')
      .eq('id', id)
      .single();

    if (listingError) {
      return NextResponse.json(
        { error: listingError.message },
        { status: listingError.code === 'PGRST116' ? 404 : 500 }
      );
    }

    // Fetch analysis if it exists
    const { data: analysis } = await supabase
      .schema('pipeline')
      .from('listing_analysis')
      .select('*')
      .eq('listing_id', id)
      .maybeSingle();

    return NextResponse.json({
      listing,
      analysis: analysis || null,
    });
  } catch (error) {
    console.error('Error fetching listing:', error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'Unknown error occurred',
      },
      { status: 500 }
    );
  }
}

