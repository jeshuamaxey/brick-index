// Service to fetch price aggregation data for LEGO sets

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/supabase.types';
import type { PriceAggregate, PriceHistoryPoint } from '@/lib/types';

export class PriceAggregationService {
  constructor(private supabase: SupabaseClient<Database>) {}

  /**
   * Get price aggregate for a specific set by set number
   */
  async getSetPriceAggregateBySetNum(setNum: string): Promise<PriceAggregate | null> {
    const { data, error } = await this.supabase
      .schema('analytics')
      .from('set_price_aggregates')
      .select('*')
      .eq('set_num', setNum)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // No data found
        return null;
      }
      throw new Error(`Failed to get price aggregate: ${error.message}`);
    }

    if (!data) {
      return null;
    }

    return {
      avgPrice: data.avg_price ?? 0,
      medianPrice: data.median_price,
      minPrice: data.min_price,
      maxPrice: data.max_price,
      avgPricePerPiece: data.avg_price_per_piece ?? 0,
      listingCount: data.listing_count ?? 0,
      lastListingSeenAt: data.last_listing_seen_at,
    };
  }

  /**
   * Get price aggregate for a specific set by ID
   */
  async getSetPriceAggregate(setId: string): Promise<PriceAggregate | null> {
    const { data, error } = await this.supabase
      .schema('analytics')
      .from('set_price_aggregates')
      .select('*')
      .eq('lego_set_id', setId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // No data found
        return null;
      }
      throw new Error(`Failed to get price aggregate: ${error.message}`);
    }

    if (!data) {
      return null;
    }

    return {
      avgPrice: data.avg_price ?? 0,
      medianPrice: data.median_price,
      minPrice: data.min_price,
      maxPrice: data.max_price,
      avgPricePerPiece: data.avg_price_per_piece ?? 0,
      listingCount: data.listing_count ?? 0,
      lastListingSeenAt: data.last_listing_seen_at,
    };
  }

  /**
   * Get price aggregates for multiple sets
   */
  async getSetPriceAggregates(setIds: string[]): Promise<Map<string, PriceAggregate>> {
    if (setIds.length === 0) {
      return new Map();
    }

    const { data, error } = await this.supabase
      .schema('analytics')
      .from('set_price_aggregates')
      .select('*')
      .in('lego_set_id', setIds);

    if (error) {
      throw new Error(`Failed to get price aggregates: ${error.message}`);
    }

    const result = new Map<string, PriceAggregate>();
    for (const row of data || []) {
      if (!row.lego_set_id) continue; // Skip rows without a set ID
      result.set(row.lego_set_id, {
        avgPrice: row.avg_price ?? 0,
        medianPrice: row.median_price,
        minPrice: row.min_price,
        maxPrice: row.max_price,
        avgPricePerPiece: row.avg_price_per_piece ?? 0,
        listingCount: row.listing_count ?? 0,
        lastListingSeenAt: row.last_listing_seen_at,
      });
    }

    return result;
  }

  /**
   * Get price history for a specific set
   * Returns daily aggregated prices over the specified number of days
   */
  async getPriceHistory(setNum: string, days: number = 90): Promise<PriceHistoryPoint[]> {
    // First, get the set ID from the set number
    const { data: set, error: setError } = await this.supabase
      .schema('catalog')
      .from('lego_sets')
      .select('id')
      .eq('set_num', setNum)
      .single();

    if (setError || !set) {
      return [];
    }

    // Calculate the date range
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Get listings linked to this set with their creation dates
    const { data: listings, error: listingsError } = await this.supabase
      .schema('pipeline')
      .from('listing_lego_set_joins')
      .select(`
        listing_id,
        listings:listing_id (
          id,
          price,
          first_seen_at,
          last_seen_at
        )
      `)
      .eq('lego_set_id', set.id)
      .eq('status', 'active');

    if (listingsError) {
      throw new Error(`Failed to get price history: ${listingsError.message}`);
    }

    // Group listings by date and calculate daily aggregates
    const dailyData = new Map<string, { prices: number[]; count: number }>();

    for (const join of listings || []) {
      const listing = join.listings as unknown as {
        id: string;
        price: number | null;
        first_seen_at: string | null;
        last_seen_at: string | null;
      };
      
      if (!listing || listing.price === null) continue;

      // Use first_seen_at as the date for this listing
      const listingDate = listing.first_seen_at
        ? new Date(listing.first_seen_at)
        : null;
      
      if (!listingDate || listingDate < startDate) continue;

      const dateKey = listingDate.toISOString().split('T')[0];
      
      if (!dailyData.has(dateKey)) {
        dailyData.set(dateKey, { prices: [], count: 0 });
      }
      
      const day = dailyData.get(dateKey)!;
      day.prices.push(listing.price);
      day.count++;
    }

    // Convert to array and sort by date
    const result: PriceHistoryPoint[] = [];
    const sortedDates = Array.from(dailyData.keys()).sort();

    for (const dateKey of sortedDates) {
      const day = dailyData.get(dateKey)!;
      const prices = day.prices.sort((a, b) => a - b);
      
      result.push({
        date: dateKey,
        avgPrice: prices.reduce((a, b) => a + b, 0) / prices.length,
        minPrice: prices[0] ?? null,
        maxPrice: prices[prices.length - 1] ?? null,
        listingCount: day.count,
      });
    }

    return result;
  }

  /**
   * Get weekly aggregated price history for a specific set
   */
  async getWeeklyPriceHistory(setNum: string, weeks: number = 12): Promise<PriceHistoryPoint[]> {
    const dailyHistory = await this.getPriceHistory(setNum, weeks * 7);

    // Group by week
    const weeklyData = new Map<string, { prices: number[]; count: number }>();

    for (const day of dailyHistory) {
      const date = new Date(day.date);
      // Get the Monday of the week
      const dayOfWeek = date.getDay();
      const diff = date.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
      const monday = new Date(date.setDate(diff));
      const weekKey = monday.toISOString().split('T')[0];

      if (!weeklyData.has(weekKey)) {
        weeklyData.set(weekKey, { prices: [], count: 0 });
      }

      const week = weeklyData.get(weekKey)!;
      week.prices.push(day.avgPrice);
      week.count += day.listingCount;
    }

    // Convert to array
    const result: PriceHistoryPoint[] = [];
    const sortedWeeks = Array.from(weeklyData.keys()).sort();

    for (const weekKey of sortedWeeks) {
      const week = weeklyData.get(weekKey)!;
      const prices = week.prices.sort((a, b) => a - b);

      result.push({
        date: weekKey,
        avgPrice: prices.reduce((a, b) => a + b, 0) / prices.length,
        minPrice: prices[0] ?? null,
        maxPrice: prices[prices.length - 1] ?? null,
        listingCount: week.count,
      });
    }

    return result;
  }

  /**
   * Refresh the materialized view
   */
  async refreshMaterializedView(): Promise<void> {
    const { error } = await this.supabase
      .schema('analytics')
      .rpc('refresh_set_price_aggregates');

    if (error) {
      throw new Error(`Failed to refresh materialized view: ${error.message}`);
    }
  }
}
