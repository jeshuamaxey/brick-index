// API endpoint to list published LEGO sets
// Public: Returns set metadata for all users
// Authenticated: Also includes pricing data

import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';
import { getAuthStatus } from '@/lib/auth/api-auth';
import { PublishingService } from '@/lib/publishing/publishing-service';
import { PriceAggregationService } from '@/lib/pricing/price-aggregation-service';
import type { PublishedSetWithPricing, PriceAggregate } from '@/lib/types';

export async function GET() {
  try {
    // Check authentication status
    const { isAuthenticated } = await getAuthStatus();

    // Get published sets
    const publishingService = new PublishingService(supabaseServer);
    const publishedSets = await publishingService.getPublishedSets();

    // If authenticated, include pricing data
    let pricing: Map<string, PriceAggregate> = new Map();

    if (isAuthenticated && publishedSets.length > 0) {
      const priceService = new PriceAggregationService(supabaseServer);
      pricing = await priceService.getSetPriceAggregates(
        publishedSets.map((s) => s.id)
      );
    }

    // Transform to response format
    const sets: PublishedSetWithPricing[] = publishedSets.map((set) => ({
      id: set.id,
      setNum: set.setNum,
      name: set.name,
      year: set.year,
      themeId: set.themeId,
      numParts: set.numParts,
      setImgUrl: set.setImgUrl,
      setUrl: set.setUrl,
      pricing: isAuthenticated ? pricing.get(set.id) || null : null,
    }));

    return NextResponse.json({
      sets,
      isAuthenticated,
      count: sets.length,
    });
  } catch (error) {
    console.error('Error fetching published sets:', error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'Unknown error occurred',
      },
      { status: 500 }
    );
  }
}
