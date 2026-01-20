// Service to validate extracted LEGO set IDs against the catalog

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/supabase.types';

export interface ValidatedSetInfo {
  legoSetId: string | null;
  setNum: string | null;
}

export class LegoSetValidator {
  constructor(private supabase: SupabaseClient<Database>) {}

  /**
   * Validate extracted set IDs against the catalog.lego_sets table
   * Uses prefix matching to handle cases where extracted ID (e.g., "75192") 
   * matches database IDs with suffixes (e.g., "75192-1")
   * @param setIds - Array of extracted set IDs (e.g., ["75192", "10294"])
   * @returns Map of extracted ID -> { legoSetId, setNum } for valid sets, null values for invalid ones
   */
  async validateSetIds(
    setIds: string[]
  ): Promise<Map<string, ValidatedSetInfo>> {
    if (setIds.length === 0) {
      return new Map();
    }

    // Remove duplicates
    const uniqueSetIds = Array.from(new Set(setIds));

    // Create a map of extracted ID -> best matching set
    const validatedMap = new Map<string, ValidatedSetInfo>();
    
    // Initialize all set IDs as null (not found)
    for (const setId of uniqueSetIds) {
      validatedMap.set(setId, { legoSetId: null, setNum: null });
    }

    // Process in batches to avoid query complexity issues
    const BATCH_SIZE = 50;
    
    for (let i = 0; i < uniqueSetIds.length; i += BATCH_SIZE) {
      const batch = uniqueSetIds.slice(i, i + BATCH_SIZE);
      
      // Query each ID in the batch separately for better performance and correctness
      for (const extractedId of batch) {
        // Query for exact match first (preferred)
        const { data: exactMatch, error: exactError } = await this.supabase
          .schema('catalog')
          .from('lego_sets')
          .select('id, set_num')
          .eq('set_num', extractedId)
          .limit(1)
          .maybeSingle();

        if (exactError) {
          console.error(`[LegoSetValidator] Error querying exact match for "${extractedId}":`, exactError);
          continue;
        }

        if (exactMatch) {
          // Found exact match - use it
          validatedMap.set(extractedId, {
            legoSetId: exactMatch.id,
            setNum: exactMatch.set_num,
          });
          continue;
        }
        
        // No exact match, try prefix match (set_num LIKE 'id-%')
        // Use ilike for case-insensitive matching (though set_num should be consistent)
        const prefixPattern = `${extractedId}-%`;
        const { data: prefixMatches, error: prefixError } = await this.supabase
          .schema('catalog')
          .from('lego_sets')
          .select('id, set_num')
          .ilike('set_num', prefixPattern)
          .limit(1);

        if (prefixError) {
          console.error(`[LegoSetValidator] Error querying prefix match for "${extractedId}" with pattern "${prefixPattern}":`, prefixError);
          continue;
        }

        if (prefixMatches && prefixMatches.length > 0) {
          // Found prefix match - use the first one
          validatedMap.set(extractedId, {
            legoSetId: prefixMatches[0].id,
            setNum: prefixMatches[0].set_num,
          });
        }
      }
    }

    return validatedMap;
  }
}
