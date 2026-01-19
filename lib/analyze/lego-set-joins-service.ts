// Service to create join records between listings and LEGO sets

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/supabase.types';

export class LegoSetJoinsService {
  constructor(private supabase: SupabaseClient<Database>) {}

  /**
   * Create join records linking a listing to validated LEGO sets
   * @param listingId - The listing ID
   * @param validatedSetIds - Map of set_num -> lego_set_id (UUID) for validated sets
   * @param reconciliationVersion - Version of reconciliation algorithm (e.g., "1.0.0")
   * @param nature - Nature of the relationship (default: 'mentioned')
   * @param cleanupMode - How to handle existing joins from older versions (default: 'supersede')
   */
  async createJoins(
    listingId: string,
    validatedSetIds: Map<string, string>,
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

    // Filter out null values (invalid set IDs)
    const validJoins = Array.from(validatedSetIds.entries())
      .filter(([_, legoSetId]) => legoSetId !== null)
      .map(([_, legoSetId]) => ({
        listing_id: listingId,
        lego_set_id: legoSetId!,
        nature,
        reconciliation_version: reconciliationVersion,
        status: 'active',
        updated_at: new Date().toISOString(),
      }));

    if (validJoins.length === 0) {
      return;
    }

    // For each join, check if there's an existing active join for the same (listing_id, lego_set_id)
    // If so, update it; otherwise insert new
    for (const join of validJoins) {
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
            updated_at: join.updated_at,
          })
          .eq('id', existing.id);

        if (updateError) {
          throw new Error(`Failed to update join: ${updateError.message}`);
        }
      } else {
        // Insert new join
        const { error: insertError } = await this.supabase
          .schema('pipeline')
          .from('listing_lego_set_joins')
          .insert(join);

        if (insertError) {
          throw new Error(`Failed to insert join: ${insertError.message}`);
        }
      }
    }
  }
}
