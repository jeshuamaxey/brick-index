// Core types for the LEGO marketplace scraper system

import type { Database } from '@/lib/supabase/supabase.types';

// Re-export database types with convenient aliases
export type RawListing = Database['pipeline']['Tables']['raw_listings']['Row'];
export type Listing = Database['pipeline']['Tables']['listings']['Row'];
export type ListingAnalysis =
  Database['pipeline']['Tables']['listing_analysis']['Row'];
export type Job = Database['pipeline']['Tables']['jobs']['Row'];
export type Profile = Database['public']['Tables']['profiles']['Row'];
export type Search = Database['public']['Tables']['searches']['Row'];
export type SearchResult = Database['public']['Tables']['search_results']['Row'];

// Catalog types
export type LegoSet = Database['catalog']['Tables']['lego_sets']['Row'];
export type Theme = Database['catalog']['Tables']['themes']['Row'];
export type CsvFileMetadata = Database['catalog']['Tables']['csv_file_metadata']['Row'];
export type PublishedTheme = Database['catalog']['Tables']['published_themes']['Row'];

// Analytics types
export type SetPriceAggregate = Database['analytics']['Views']['set_price_aggregates']['Row'];

// Join types
export type LegoSetJoin = Database['pipeline']['Tables']['listing_lego_set_joins']['Row'];

// Database enum types
export type JobType = Database['pipeline']['Enums']['job_type'];

// Non-database types (computed/transient or not stored in DB)
export type Marketplace = 'ebay' | 'facebook' | string;

// Note: ListingStatus and AlertFrequency are stored as strings in the database
// but we keep these as type aliases for type safety in application code
export type ListingStatus = 'active' | 'sold' | 'expired' | 'removed';
export type AlertFrequency = 'daily' | 'weekly';

// Legacy type alias for backward compatibility during migration
export type CaptureJob = Job;

export interface ExtractedData {
  piece_count: number | null;
  estimated_piece_count: boolean;
  minifig_count: number | null;
  estimated_minifig_count: boolean;
  condition: 'new' | 'used' | 'unknown';
  metadata: Record<string, unknown>;
}

export interface ValueScore {
  score: number | null;
  confidence: number; // 0.0 to 1.0
}

// Dataset types
export interface Dataset {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
  user_id: string;
  listing_count?: number; // Optional, for display purposes
}

// Consumer pricing types
export interface PriceAggregate {
  avgPrice: number;
  medianPrice: number | null;
  minPrice: number | null;
  maxPrice: number | null;
  avgPricePerPiece: number;
  listingCount: number;
  changePercentage?: number;
  lastListingSeenAt?: string | null;
}

export interface PriceHistoryPoint {
  date: string;
  avgPrice: number;
  minPrice: number | null;
  maxPrice: number | null;
  listingCount: number;
}

// Published set with pricing data for consumer pages
export interface PublishedSetWithPricing {
  id: string;
  setNum: string;
  name: string;
  year: number | null;
  themeId: number | null;
  numParts: number | null;
  setImgUrl: string | null;
  setUrl: string | null;
  pricing: PriceAggregate | null;
}

