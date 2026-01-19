// Service to validate extracted LEGO set IDs against the catalog

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/supabase.types';

export class LegoSetValidator {
  constructor(private supabase: SupabaseClient<Database>) {}

  /**
   * Validate extracted set IDs against the catalog.lego_sets table
   * @param setIds - Array of extracted set IDs (e.g., ["75192-1", "10294"])
   * @returns Map of set_num -> lego_set_id (UUID) for valid sets, null for invalid ones
   */
  async validateSetIds(
    setIds: string[]
  ): Promise<Map<string, string | null>> {
    if (setIds.length === 0) {
      return new Map();
    }

    // Remove duplicates
    const uniqueSetIds = Array.from(new Set(setIds));

    // Query catalog.lego_sets for matching set_num values
    const { data: legoSets, error } = await this.supabase
      .schema('catalog')
      .from('lego_sets')
      .select('id, set_num')
      .in('set_num', uniqueSetIds);

    if (error) {
      throw new Error(`Failed to validate set IDs: ${error.message}`);
    }

    // Create a map of set_num -> lego_set_id for found sets
    const validatedMap = new Map<string, string | null>();
    const foundSetNums = new Set((legoSets || []).map((set) => set.set_num));

    // Initialize all set IDs as null (not found)
    for (const setId of uniqueSetIds) {
      validatedMap.set(setId, null);
    }

    // Update with found set IDs
    for (const set of legoSets || []) {
      validatedMap.set(set.set_num, set.id);
    }

    return validatedMap;
  }
}
