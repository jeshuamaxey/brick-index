// Tests for value evaluator

import { describe, it, expect } from 'vitest';
import { SimplePricePerPieceEvaluator } from '@/lib/analyze/value-evaluator/simple-price-per-piece';
import type { Listing, ListingAnalysis } from '@/lib/types';

describe('SimplePricePerPieceEvaluator', () => {
  const evaluator = new SimplePricePerPieceEvaluator();

  it('should calculate price per piece correctly', () => {
    const listing: Listing = {
      id: '1',
      raw_listing_id: 'raw1',
      marketplace: 'ebay',
      external_id: 'ext1',
      title: 'Test',
      description: null,
      price: 100,
      currency: 'USD',
      url: 'http://example.com',
      image_urls: [],
      location: null,
      seller_name: null,
      seller_rating: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      first_seen_at: new Date().toISOString(),
      last_seen_at: new Date().toISOString(),
      status: 'active',
      job_id: null,
      reconciled_at: null,
      reconciliation_version: null,
      enriched_at: null,
      enriched_raw_listing_id: null,
      additional_images: [],
      condition_description: null,
      category_path: null,
      item_location: null,
      estimated_availabilities: null,
      buying_options: [],
    };

    const analysis: ListingAnalysis = {
      id: '1',
      listing_id: '1',
      piece_count: 1000,
      estimated_piece_count: false,
      minifig_count: null,
      estimated_minifig_count: false,
      condition: 'used',
      price_per_piece: null,
      analysis_metadata: null,
      analyzed_at: new Date().toISOString(),
      analysis_version: '1.0.0',
    };

    const result = evaluator.evaluate(listing, analysis);

    expect(result.score).toBe(0.1); // $100 / 1000 pieces = $0.10 per piece
    expect(result.confidence).toBe(1.0);
  });

  it('should return lower confidence for estimated piece count', () => {
    const listing: Listing = {
      id: '1',
      raw_listing_id: 'raw1',
      marketplace: 'ebay',
      external_id: 'ext1',
      title: 'Test',
      description: null,
      price: 50,
      currency: 'USD',
      url: 'http://example.com',
      image_urls: [],
      location: null,
      seller_name: null,
      seller_rating: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      first_seen_at: new Date().toISOString(),
      last_seen_at: new Date().toISOString(),
      status: 'active',
      job_id: null,
      reconciled_at: null,
      reconciliation_version: null,
      enriched_at: null,
      enriched_raw_listing_id: null,
      additional_images: [],
      condition_description: null,
      category_path: null,
      item_location: null,
      estimated_availabilities: null,
      buying_options: [],
    };

    const analysis: ListingAnalysis = {
      id: '1',
      listing_id: '1',
      piece_count: 500,
      estimated_piece_count: true,
      minifig_count: null,
      estimated_minifig_count: false,
      condition: 'used',
      price_per_piece: null,
      analysis_metadata: null,
      analyzed_at: new Date().toISOString(),
      analysis_version: '1.0.0',
    };

    const result = evaluator.evaluate(listing, analysis);

    expect(result.score).toBe(0.1); // $50 / 500 pieces = $0.10 per piece
    expect(result.confidence).toBe(0.7);
  });

  it('should return null score if piece count is missing', () => {
    const listing: Listing = {
      id: '1',
      raw_listing_id: 'raw1',
      marketplace: 'ebay',
      external_id: 'ext1',
      title: 'Test',
      description: null,
      price: 100,
      currency: 'USD',
      url: 'http://example.com',
      image_urls: [],
      location: null,
      seller_name: null,
      seller_rating: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      first_seen_at: new Date().toISOString(),
      last_seen_at: new Date().toISOString(),
      status: 'active',
      job_id: null,
      reconciled_at: null,
      reconciliation_version: null,
      enriched_at: null,
      enriched_raw_listing_id: null,
      additional_images: [],
      condition_description: null,
      category_path: null,
      item_location: null,
      estimated_availabilities: null,
      buying_options: [],
    };

    const analysis: ListingAnalysis = {
      id: '1',
      listing_id: '1',
      piece_count: null,
      estimated_piece_count: false,
      minifig_count: null,
      estimated_minifig_count: false,
      condition: 'unknown',
      price_per_piece: null,
      analysis_metadata: null,
      analyzed_at: new Date().toISOString(),
      analysis_version: '1.0.0',
    };

    const result = evaluator.evaluate(listing, analysis);

    expect(result.score).toBeNull();
    expect(result.confidence).toBe(0);
  });

  it('should return null score if price is missing', () => {
    const listing: Listing = {
      id: '1',
      raw_listing_id: 'raw1',
      marketplace: 'ebay',
      external_id: 'ext1',
      title: 'Test',
      description: null,
      price: null,
      currency: null,
      url: 'http://example.com',
      image_urls: [],
      location: null,
      seller_name: null,
      seller_rating: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      first_seen_at: new Date().toISOString(),
      last_seen_at: new Date().toISOString(),
      status: 'active',
      job_id: null,
      reconciled_at: null,
      reconciliation_version: null,
      enriched_at: null,
      enriched_raw_listing_id: null,
      additional_images: [],
      condition_description: null,
      category_path: null,
      item_location: null,
      estimated_availabilities: null,
      buying_options: [],
    };

    const analysis: ListingAnalysis = {
      id: '1',
      listing_id: '1',
      piece_count: 1000,
      estimated_piece_count: false,
      minifig_count: null,
      estimated_minifig_count: false,
      condition: 'used',
      price_per_piece: null,
      analysis_metadata: null,
      analyzed_at: new Date().toISOString(),
      analysis_version: '1.0.0',
    };

    const result = evaluator.evaluate(listing, analysis);

    expect(result.score).toBeNull();
    expect(result.confidence).toBe(0);
  });
});

