// Service to create join records between listings and LEGO sets

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/supabase.types';

export class LegoSetJoinsService {
  constructor(private supabase: SupabaseClient<Database>) {}

  /**
   * Check if a set_num prefix is in the year-like range (1990-2050)
   * @param setNum - The set_num from the database (e.g., "2020-1" or "1995")
   * @returns true if the first part of set_num is a 4-digit number in range 1990-2050
   */
  private isYearLikeSetNum(setNum: string): boolean {
    const firstPart = setNum.split('-')[0];
    if (!/^\d{4}$/.test(firstPart)) {
      return false;
    }
    const year = parseInt(firstPart, 10);
    return year >= 1990 && year <= 2050;
  }

  /**
   * Create join records linking a listing to validated LEGO sets
   * @param listingId - The listing ID
   * @param validatedSetIds - Map of extracted ID -> { legoSetId, setNum } for validated sets
   * @param reconciliationVersion - Version of reconciliation algorithm (e.g., "1.0.0")
   * @param nature - Nature of the relationship (default: 'mentioned')
   * @param cleanupMode - How to handle existing joins from older versions (default: 'supersede')
   */
  async createJoins(
    listingId: string,
    validatedSetIds: Map<string, { legoSetId: string; setNum: string }>,
    reconciliationVersion: string,
    nature: string = 'mentioned',
    cleanupMode: 'delete' | 'supersede' | 'keep' = 'supersede'
  ): Promise<void> {
    // Handle existing joins from older versions
    if (cleanupMode === 'delete' || cleanupMode === 'supersede') {
      // Find existing active joins for this listing
      const { data: existingJoins, error: fetchError } = await this.supabase
        .schema('pipeline')
        .from('listing_lego_set_joins')
        .select('id, reconciliation_version')
        .eq('listing_id', listingId)
        .eq('status', 'active');

      if (fetchError) {
        throw new Error(`Failed to fetch existing joins: ${fetchError.message}`);
      }

      if (existingJoins && existingJoins.length > 0) {
        // Check if any are from older versions
        const olderJoins = existingJoins.filter(
          (join) => join.reconciliation_version !== reconciliationVersion
        );

        if (olderJoins.length > 0) {
          if (cleanupMode === 'delete') {
            // Delete old joins
            const { error: deleteError } = await this.supabase
              .schema('pipeline')
              .from('listing_lego_set_joins')
              .delete()
              .in(
                'id',
                olderJoins.map((j) => j.id)
              );

            if (deleteError) {
              throw new Error(`Failed to delete old joins: ${deleteError.message}`);
            }
          } else if (cleanupMode === 'supersede') {
            // Mark old joins as superseded
            const { error: updateError } = await this.supabase
              .schema('pipeline')
              .from('listing_lego_set_joins')
              .update({
                status: 'superseded',
                updated_at: new Date().toISOString(),
              })
              .in(
                'id',
                olderJoins.map((j) => j.id)
              );

            if (updateError) {
              throw new Error(
                `Failed to supersede old joins: ${updateError.message}`
              );
            }
          }
        }
      }
    }

    // Create join records with year annotation
    const validJoins = Array.from(validatedSetIds.entries())
      .map(([extractedId, setInfo]) => {
        const potentialYearMatch = this.isYearLikeSetNum(setInfo.setNum);
        const join = {
          listing_id: listingId,
          lego_set_id: setInfo.legoSetId,
          nature,
          reconciliation_version: reconciliationVersion,
          status: 'active' as const,
          potential_year_match: potentialYearMatch,
          updated_at: new Date().toISOString(),
        };
        return join;
      });

    if (validJoins.length === 0) {
      return;
    }

    // For each join, check if there's an existing active join for the same (listing_id, lego_set_id)
    // If so, update it; otherwise insert new
    for (let i = 0; i < validJoins.length; i++) {
      const join = validJoins[i];
      
      // Check for existing active join
      const { data: existing, error: checkError } = await this.supabase
        .schema('pipeline')
        .from('listing_lego_set_joins')
        .select('id')
        .eq('listing_id', join.listing_id)
        .eq('lego_set_id', join.lego_set_id)
        .eq('status', 'active')
        .maybeSingle();

      if (checkError) {
        console.error(`[LegoSetJoinsService] Error checking existing join:`, checkError);
        throw new Error(`Failed to check existing join: ${checkError.message}`);
      }

      if (existing) {
        // Update existing active join
        const { error: updateError } = await this.supabase
          .schema('pipeline')
          .from('listing_lego_set_joins')
          .update({
            reconciliation_version: join.reconciliation_version,
            nature: join.nature,
            potential_year_match: join.potential_year_match,
            updated_at: join.updated_at,
          })
          .eq('id', existing.id);

        if (updateError) {
          console.error(`[LegoSetJoinsService] Error updating join:`, updateError);
          throw new Error(`Failed to update join: ${updateError.message}`);
        }
      } else {
        // Insert new join
        const { error: insertError } = await this.supabase
          .schema('pipeline')
          .from('listing_lego_set_joins')
          .insert(join)
          .select();

        if (insertError) {
          console.error(`[LegoSetJoinsService] Error inserting join:`, insertError);
          throw new Error(`Failed to insert join: ${insertError.message}`);
        }
      }
    }
  }
}
