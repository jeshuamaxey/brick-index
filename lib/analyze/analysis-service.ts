// Service to orchestrate analysis of listings

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Json } from '@/lib/supabase/supabase.types';
import type { Listing, ListingAnalysis, Job, JobType } from '@/lib/types';
import { TextExtractor } from './text-extractor';
import { SimplePricePerPieceEvaluator } from './value-evaluator/simple-price-per-piece';
import { BaseJobService } from '@/lib/jobs/base-job-service';
import { JobProgressTracker } from '@/lib/jobs/job-progress-tracker';

export interface AnalysisResult {
  jobId: string;
  total: number;
  succeeded: number;
  failed: number;
  errors: Array<{ listingId: string; error: string }>;
}

export class AnalysisService {
  private textExtractor: TextExtractor;
  private valueEvaluator: SimplePricePerPieceEvaluator;
  private jobService: BaseJobService;

  constructor(private supabase: SupabaseClient<Database>) {
    this.textExtractor = new TextExtractor();
    this.valueEvaluator = new SimplePricePerPieceEvaluator();
    this.jobService = new BaseJobService(supabase);
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
      analysis_metadata: extractedData.metadata as Json,
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

      result = updated;
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

      result = inserted;
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

  /**
   * Analyze listings with job tracking
   * @param listingIds - Array of listing IDs to analyze (if empty, finds unanalyzed listings)
   * @param limit - Maximum number of listings to analyze if listingIds is empty
   * @returns Analysis result with job tracking
   */
  async analyzeListingsWithJob(
    listingIds?: string[],
    limit?: number
  ): Promise<AnalysisResult> {
    // Create job
    // Note: 'analyze_listings' is added to the enum in migration, but types may not be updated yet
    const job = await this.jobService.createJob(
      'analyze_listings' as JobType,
      'all', // Marketplace doesn't really apply to analysis
      {
        listingIds: listingIds || null,
        limit: limit || null,
      }
    );

    const jobId = job.id;

    // Create progress tracker
    const progressTracker = new JobProgressTracker({
      milestoneInterval: 10,
      timeIntervalMs: 5000,
      onUpdate: async (update) => {
        await this.jobService.updateJobProgress(jobId, update.message, update.stats);
      },
    });

    try {
      let listingIdsToAnalyze: string[];

      if (listingIds && listingIds.length > 0) {
        // Use provided listing IDs
        listingIdsToAnalyze = listingIds;
        await progressTracker.forceUpdate(
          `Found ${listingIds.length} listings to analyze...`,
          { listings_found: listingIds.length }
        );
      } else {
        // Find unanalyzed listings
        await progressTracker.forceUpdate('Finding unanalyzed listings...');

        // Get all listing IDs that already have analysis
        const { data: analyzedListings, error: analyzedError } =
          await this.supabase
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

        // Fetch active listings
        const maxLimit = limit || 100;
        const { data: allListings, error } = await this.supabase
          .schema('pipeline')
          .from('listings')
          .select('id')
          .eq('status', 'active')
          .limit(maxLimit * 2); // Fetch more to account for filtering

        if (error) {
          throw new Error(`Failed to fetch listings: ${error.message}`);
        }

        if (!allListings || allListings.length === 0) {
          await this.jobService.completeJob(
            jobId,
            { listings_found: 0, listings_new: 0, listings_updated: 0 },
            'No listings found to analyze'
          );
          return {
            jobId,
            total: 0,
            succeeded: 0,
            failed: 0,
            errors: [],
          };
        }

        // Filter out listings that already have analysis
        const unanalyzedListings = allListings.filter(
          (listing) => !analyzedListingIds.has(listing.id)
        );

        if (unanalyzedListings.length === 0) {
          await this.jobService.completeJob(
            jobId,
            { listings_found: 0, listings_new: 0, listings_updated: 0 },
            'All listings already analyzed'
          );
          return {
            jobId,
            total: 0,
            succeeded: 0,
            failed: 0,
            errors: [],
          };
        }

        // Take only up to the limit
        listingIdsToAnalyze = unanalyzedListings
          .slice(0, maxLimit)
          .map((l) => l.id);

        await progressTracker.forceUpdate(
          `Found ${listingIdsToAnalyze.length} listings to analyze...`,
          { listings_found: listingIdsToAnalyze.length }
        );
      }

      const result: AnalysisResult = {
        jobId,
        total: listingIdsToAnalyze.length,
        succeeded: 0,
        failed: 0,
        errors: [],
      };

      progressTracker.reset();

      // Analyze each listing
      for (let i = 0; i < listingIdsToAnalyze.length; i++) {
        const listingId = listingIdsToAnalyze[i];
        try {
          await this.analyzeListing(listingId);
          result.succeeded++;
        } catch (error) {
          result.failed++;
          const errorMessage =
            error instanceof Error ? error.message : 'Unknown error';
          result.errors.push({
            listingId,
            error: errorMessage,
          });
          console.error(`Error analyzing listing ${listingId}:`, errorMessage);
        }

        // Update progress periodically
        await progressTracker.recordProgress(
          `Analyzing listing ${i + 1} of ${listingIdsToAnalyze.length}...`,
          {
            listings_found: listingIdsToAnalyze.length,
            listings_new: result.succeeded,
            listings_updated: result.failed,
          }
        );
      }

      // Complete or fail job
      const finalStatus = result.failed === result.total ? 'failed' : 'completed';
      const finalMessage =
        result.failed > 0 && result.succeeded === 0
          ? `All ${result.total} listings failed to analyze`
          : result.failed > 0
          ? `Completed: ${result.succeeded} analyzed successfully, ${result.failed} failed`
          : `Completed: ${result.succeeded} listings analyzed successfully`;

      if (finalStatus === 'failed') {
        await this.jobService.failJob(
          jobId,
          result.failed > 0 && result.succeeded === 0
            ? `All ${result.total} listings failed to analyze`
            : `${result.failed} of ${result.total} listings failed to analyze`
        );
      } else {
        await this.jobService.completeJob(
          jobId,
          {
            listings_found: result.total,
            listings_new: result.succeeded,
            listings_updated: result.failed,
          },
          finalMessage
        );
      }

      return result;
    } catch (error) {
      // Mark job as failed if not already handled
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      await this.jobService.failJob(jobId, errorMessage);
      throw error;
    }
  }
}

