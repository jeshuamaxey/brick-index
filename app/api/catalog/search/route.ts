// API route to search LEGO sets in catalog by name

import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';

export interface LegoSetSearchResult {
  set_num: string;
  name: string;
  year: number | null;
  set_img_url: string | null;
  num_parts: number | null;
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get('q');

    if (!query || query.length < 2) {
      return NextResponse.json({
        results: [],
        message: 'Search query must be at least 2 characters',
      });
    }

    // Search by name using case-insensitive pattern matching
    // Uses existing index: idx_lego_sets_name on catalog.lego_sets(name)
    const { data, error } = await supabaseServer
      .schema('catalog')
      .from('lego_sets')
      .select('set_num, name, year, set_img_url, num_parts')
      .ilike('name', `%${query}%`)
      .order('year', { ascending: false, nullsFirst: false })
      .limit(10);

    if (error) {
      console.error('Error searching LEGO sets:', error);
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      results: (data || []) as LegoSetSearchResult[],
    });
  } catch (error) {
    console.error('Error in catalog search:', error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'Unknown error occurred',
      },
      { status: 500 }
    );
  }
}
