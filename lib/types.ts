// Core types for the LEGO marketplace scraper system

export type Marketplace = 'ebay' | 'facebook' | string;

export type ListingStatus = 'active' | 'sold' | 'expired' | 'removed';

export type AlertFrequency = 'daily' | 'weekly';

export interface RawListing {
  id: string;
  created_at: Date;
  marketplace: Marketplace;
  api_response: Record<string, unknown>;
}

export interface Listing {
  id: string;
  raw_listing_id: string;
  marketplace: Marketplace;
  external_id: string;
  title: string;
  description: string | null;
  price: number | null;
  currency: string | null;
  url: string;
  image_urls: string[];
  location: string | null;
  seller_name: string | null;
  seller_rating: number | null;
  created_at: Date;
  updated_at: Date;
  first_seen_at: Date;
  last_seen_at: Date;
  status: ListingStatus;
}

export interface ListingAnalysis {
  id: string;
  listing_id: string;
  piece_count: number | null;
  estimated_piece_count: boolean;
  minifig_count: number | null;
  estimated_minifig_count: boolean;
  condition: 'new' | 'used' | 'unknown';
  price_per_piece: number | null;
  analysis_metadata: Record<string, unknown> | null;
  analyzed_at: Date;
  analysis_version: string;
}

export interface Profile {
  id: string;
  created_at: Date;
  updated_at: Date;
}

export interface Search {
  id: string;
  profile_id: string;
  name: string;
  max_price_per_piece: number;
  email_alerts_enabled: boolean;
  alert_frequency: AlertFrequency;
  created_at: Date;
  updated_at: Date;
}

export interface SearchResult {
  id: string;
  search_id: string;
  listing_id: string;
  notified_at: Date | null;
  created_at: Date;
}

export interface CaptureJob {
  id: string;
  marketplace: Marketplace;
  status: 'running' | 'completed' | 'failed';
  listings_found: number;
  listings_new: number;
  listings_updated: number;
  started_at: Date;
  completed_at: Date | null;
  error_message: string | null;
}

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

