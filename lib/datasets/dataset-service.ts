// Service to handle dataset operations

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/supabase.types';

export interface Dataset {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
  user_id: string;
  listing_count?: number; // Optional, for display purposes
}

export class DatasetService {
  constructor(private supabase: SupabaseClient<Database>) {}

  /**
   * Create a new dataset
   * @param userId - The user ID who owns the dataset
   * @param name - The dataset name
   * @param description - Optional description
   * @returns The created dataset
   */
  async createDataset(
    userId: string,
    name: string,
    description?: string
  ): Promise<Dataset> {
    const { data, error } = await this.supabase
      .schema('public')
      .from('datasets')
      .insert({
        user_id: userId,
        name: name.trim(),
        description: description?.trim() || null,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create dataset: ${error.message}`);
    }

    if (!data) {
      throw new Error('Failed to create dataset: No data returned');
    }

    return data as Dataset;
  }

  /**
   * Get a dataset by name for a specific user
   * @param userId - The user ID
   * @param name - The dataset name
   * @returns The dataset if found, null otherwise
   */
  async getDatasetByName(userId: string, name: string): Promise<Dataset | null> {
    const { data, error } = await this.supabase
      .schema('public')
      .from('datasets')
      .select()
      .eq('user_id', userId)
      .eq('name', name.trim())
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to get dataset: ${error.message}`);
    }

    return data as Dataset | null;
  }

  /**
   * Get or create a dataset (idempotent operation)
   * @param userId - The user ID
   * @param name - The dataset name
   * @param description - Optional description (only used if creating new dataset)
   * @returns The existing or newly created dataset
   */
  async getOrCreateDataset(
    userId: string,
    name: string,
    description?: string
  ): Promise<Dataset> {
    // Try to get existing dataset first
    const existing = await this.getDatasetByName(userId, name);
    if (existing) {
      return existing;
    }

    // Create new dataset if it doesn't exist
    return await this.createDataset(userId, name, description);
  }

  /**
   * Get all datasets for a user
   * @param userId - The user ID
   * @returns Array of datasets with optional listing counts (includes both raw_listings and listings)
   */
  async getDatasetsForUser(userId: string): Promise<Dataset[]> {
    const { data: datasets, error } = await this.supabase
      .schema('public')
      .from('datasets')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to get datasets: ${error.message}`);
    }

    if (!datasets || datasets.length === 0) {
      return [];
    }

    // Get combined counts (raw_listings + listings) for each dataset
    const datasetsWithCounts = await Promise.all(
      datasets.map(async (dataset) => {
        // Count listings
        const { count: listingsCount, error: listingsError } = await this.supabase
          .schema('public')
          .from('dataset_listings')
          .select('*', { count: 'exact', head: true })
          .eq('dataset_id', dataset.id);

        // Count raw_listings
        const { count: rawListingsCount, error: rawListingsError } = await this.supabase
          .schema('public')
          .from('dataset_raw_listings')
          .select('*', { count: 'exact', head: true })
          .eq('dataset_id', dataset.id);

        if (listingsError || rawListingsError) {
          console.error(`Error getting counts for dataset ${dataset.id}:`, listingsError || rawListingsError);
          return { ...dataset, listing_count: 0 };
        }

        const totalCount = (listingsCount || 0) + (rawListingsCount || 0);
        return { ...dataset, listing_count: totalCount };
      })
    );

    return datasetsWithCounts as Dataset[];
  }

  /**
   * Get a dataset by ID
   * @param datasetId - The dataset ID
   * @returns The dataset if found, null otherwise
   */
  async getDatasetById(datasetId: string): Promise<Dataset | null> {
    const { data, error } = await this.supabase
      .schema('public')
      .from('datasets')
      .select()
      .eq('id', datasetId)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to get dataset: ${error.message}`);
    }

    return data as Dataset | null;
  }

  /**
   * Get all listings in a dataset
   * @param datasetId - The dataset ID
   * @returns Array of listing IDs
   */
  async getDatasetListings(datasetId: string): Promise<string[]> {
    const { data, error } = await this.supabase
      .schema('public')
      .from('dataset_listings')
      .select('listing_id')
      .eq('dataset_id', datasetId);

    if (error) {
      throw new Error(`Failed to get dataset listings: ${error.message}`);
    }

    return (data || []).map((row) => row.listing_id);
  }

  /**
   * Add a listing to a dataset (idempotent)
   * @param datasetId - The dataset ID
   * @param listingId - The listing ID
   */
  async addListingToDataset(
    datasetId: string,
    listingId: string
  ): Promise<void> {
    const { error } = await this.supabase
      .schema('public')
      .from('dataset_listings')
      .insert({
        dataset_id: datasetId,
        listing_id: listingId,
      })
      .select()
      .single();

    // If error is a unique constraint violation, that's fine (idempotent)
    if (error && error.code !== '23505') {
      // 23505 is PostgreSQL unique violation error code
      throw new Error(`Failed to add listing to dataset: ${error.message}`);
    }
  }

  /**
   * Batch add listings to a dataset (idempotent)
   * @param datasetId - The dataset ID
   * @param listingIds - Array of listing IDs
   */
  async addListingsToDataset(
    datasetId: string,
    listingIds: string[]
  ): Promise<void> {
    if (listingIds.length === 0) {
      return;
    }

    // Prepare insert data
    const inserts = listingIds.map((listingId) => ({
      dataset_id: datasetId,
      listing_id: listingId,
    }));

    // Use upsert with ON CONFLICT DO NOTHING to make it idempotent
    const { error } = await this.supabase
      .schema('public')
      .from('dataset_listings')
      .upsert(inserts, {
        onConflict: 'dataset_id,listing_id',
        ignoreDuplicates: true,
      });

    if (error) {
      throw new Error(`Failed to add listings to dataset: ${error.message}`);
    }
  }

  /**
   * Remove a listing from a dataset
   * @param datasetId - The dataset ID
   * @param listingId - The listing ID
   */
  async removeListingFromDataset(
    datasetId: string,
    listingId: string
  ): Promise<void> {
    const { error } = await this.supabase
      .schema('public')
      .from('dataset_listings')
      .delete()
      .eq('dataset_id', datasetId)
      .eq('listing_id', listingId);

    if (error) {
      throw new Error(`Failed to remove listing from dataset: ${error.message}`);
    }
  }

  /**
   * Get all raw_listings in a dataset
   * @param datasetId - The dataset ID
   * @returns Array of raw_listing IDs
   */
  async getDatasetRawListings(datasetId: string): Promise<string[]> {
    const { data, error } = await this.supabase
      .schema('public')
      .from('dataset_raw_listings')
      .select('raw_listing_id')
      .eq('dataset_id', datasetId);

    if (error) {
      throw new Error(`Failed to get dataset raw_listings: ${error.message}`);
    }

    return (data || []).map((row) => row.raw_listing_id);
  }

  /**
   * Add a raw_listing to a dataset (idempotent)
   * @param datasetId - The dataset ID
   * @param rawListingId - The raw_listing ID
   */
  async addRawListingToDataset(
    datasetId: string,
    rawListingId: string
  ): Promise<void> {
    const { error } = await this.supabase
      .schema('public')
      .from('dataset_raw_listings')
      .insert({
        dataset_id: datasetId,
        raw_listing_id: rawListingId,
      })
      .select()
      .single();

    // If error is a unique constraint violation, that's fine (idempotent)
    if (error && error.code !== '23505') {
      // 23505 is PostgreSQL unique violation error code
      throw new Error(`Failed to add raw_listing to dataset: ${error.message}`);
    }
  }

  /**
   * Batch add raw_listings to a dataset (idempotent)
   * @param datasetId - The dataset ID
   * @param rawListingIds - Array of raw_listing IDs
   */
  async addRawListingsToDataset(
    datasetId: string,
    rawListingIds: string[]
  ): Promise<void> {
    if (rawListingIds.length === 0) {
      return;
    }

    // Prepare insert data
    const inserts = rawListingIds.map((rawListingId) => ({
      dataset_id: datasetId,
      raw_listing_id: rawListingId,
    }));

    // Use upsert with ON CONFLICT DO NOTHING to make it idempotent
    const { error } = await this.supabase
      .schema('public')
      .from('dataset_raw_listings')
      .upsert(inserts, {
        onConflict: 'dataset_id,raw_listing_id',
        ignoreDuplicates: true,
      });

    if (error) {
      throw new Error(`Failed to add raw_listings to dataset: ${error.message}`);
    }
  }

  /**
   * Remove a raw_listing from a dataset
   * @param datasetId - The dataset ID
   * @param rawListingId - The raw_listing ID
   */
  async removeRawListingFromDataset(
    datasetId: string,
    rawListingId: string
  ): Promise<void> {
    const { error } = await this.supabase
      .schema('public')
      .from('dataset_raw_listings')
      .delete()
      .eq('dataset_id', datasetId)
      .eq('raw_listing_id', rawListingId);

    if (error) {
      throw new Error(`Failed to remove raw_listing from dataset: ${error.message}`);
    }
  }

  /**
   * Delete a dataset
   * @param datasetId - The dataset ID
   */
  async deleteDataset(datasetId: string): Promise<void> {
    const { error } = await this.supabase
      .schema('public')
      .from('datasets')
      .delete()
      .eq('id', datasetId);

    if (error) {
      throw new Error(`Failed to delete dataset: ${error.message}`);
    }
  }
}
