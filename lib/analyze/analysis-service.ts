// Service to orchestrate analysis of listings

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Listing, ListingAnalysis } from '@/lib/types';
import { TextExtractor } from './text-extractor';
import { SimplePricePerPieceEvaluator } from './value-evaluator/simple-price-per-piece';

export class AnalysisService {
  private textExtractor: TextExtractor;
  private valueEvaluator: SimplePricePerPieceEvaluator;

  constructor(private supabase: SupabaseClient) {
    this.textExtractor = new TextExtractor();
    this.valueEvaluator = new SimplePricePerPieceEvaluator();
  }

  /**
   * Analyze a listing and store the results
   * @param listingId - The ID of the listing to analyze
   * @returns The analysis result
   */
  async analyzeListing(listingId: string): Promise<ListingAnalysis> {
    // Fetch the listing
    const { data: listing, error: listingError } = await this.supabase
      .schema('pipeline')
      .from('listings')
      .select('*')
      .eq('id', listingId)
      .single();

    if (listingError || !listing) {
      throw new Error(
        `Listing not found: ${listingError?.message || 'Unknown error'}`
      );
    }

    // Combine title and description for extraction
    const text = [listing.title, listing.description]
      .filter(Boolean)
      .join(' ');

    // Extract data from text
    const extractedData = this.textExtractor.extractAll(text);

    // Calculate price per piece if we have both price and piece count
    let pricePerPiece: number | null = null;
    if (listing.price && extractedData.piece_count) {
      pricePerPiece = listing.price / extractedData.piece_count;
    }

    // Create analysis record
    const analysis: Omit<ListingAnalysis, 'id' | 'analyzed_at'> = {
      listing_id: listingId,
      piece_count: extractedData.piece_count,
      estimated_piece_count: extractedData.estimated_piece_count,
      minifig_count: extractedData.minifig_count,
      estimated_minifig_count: extractedData.estimated_minifig_count,
      condition: extractedData.condition,
      price_per_piece: pricePerPiece,
      analysis_metadata: extractedData.metadata,
      analysis_version: '1.0.0',
    };

    // Check if analysis already exists
    const { data: existingAnalysis } = await this.supabase
      .schema('pipeline')
      .from('listing_analysis')
      .select('id')
      .eq('listing_id', listingId)
      .maybeSingle();

    let result: ListingAnalysis;

    if (existingAnalysis) {
      // Update existing analysis
      const { data: updated, error: updateError } = await this.supabase
        .schema('pipeline')
        .from('listing_analysis')
        .update({
          ...analysis,
          analyzed_at: new Date().toISOString(),
        })
        .eq('id', existingAnalysis.id)
        .select()
        .single();

      if (updateError) {
        throw new Error(`Failed to update analysis: ${updateError.message}`);
      }

      result = {
        ...updated,
        analyzed_at: new Date(updated.analyzed_at),
      };
    } else {
      // Insert new analysis
      const { data: inserted, error: insertError } = await this.supabase
        .schema('pipeline')
        .from('listing_analysis')
        .insert({
          ...analysis,
          analyzed_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (insertError) {
        throw new Error(`Failed to insert analysis: ${insertError.message}`);
      }

      result = {
        ...inserted,
        analyzed_at: new Date(inserted.analyzed_at),
      };
    }

    return result;
  }

  /**
   * Analyze multiple listings
   * @param listingIds - Array of listing IDs to analyze
   * @returns Array of analysis results
   */
  async analyzeListings(listingIds: string[]): Promise<ListingAnalysis[]> {
    const results: ListingAnalysis[] = [];

    for (const listingId of listingIds) {
      try {
        const analysis = await this.analyzeListing(listingId);
        results.push(analysis);
      } catch (error) {
        console.error(`Error analyzing listing ${listingId}:`, error);
      }
    }

    return results;
  }

  /**
   * Analyze all listings that don't have analysis yet
   * @param limit - Maximum number of listings to analyze (default: 100)
   * @returns Number of listings analyzed
   */
  async analyzeUnanalyzedListings(limit = 100): Promise<number> {
    // First, get all listing IDs that already have analysis
    const { data: analyzedListings, error: analyzedError } = await this.supabase
      .schema('pipeline')
      .from('listing_analysis')
      .select('listing_id');

    if (analyzedError) {
      throw new Error(
        `Failed to fetch analyzed listings: ${analyzedError.message}`
      );
    }

    const analyzedListingIds = new Set(
      (analyzedListings || []).map((a) => a.listing_id)
    );

    // Fetch all active listings
    const { data: allListings, error } = await this.supabase
      .schema('pipeline')
      .from('listings')
      .select('id')
      .eq('status', 'active')
      .limit(limit * 2); // Fetch more to account for filtering

    if (error) {
      throw new Error(`Failed to fetch listings: ${error.message}`);
    }

    if (!allListings || allListings.length === 0) {
      return 0;
    }

    // Filter out listings that already have analysis
    const unanalyzedListings = allListings.filter(
      (listing) => !analyzedListingIds.has(listing.id)
    );

    if (unanalyzedListings.length === 0) {
      return 0;
    }

    // Take only up to the limit
    const listingIds = unanalyzedListings
      .slice(0, limit)
      .map((l) => l.id);

    await this.analyzeListings(listingIds);

    return listingIds.length;
  }
}

