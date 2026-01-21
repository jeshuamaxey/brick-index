// Inngest function for analysis jobs
// Handles long-running analysis jobs by breaking work into batches

import { inngest } from '@/lib/inngest/client';
import { supabaseServer } from '@/lib/supabase/server';
import { BaseJobService } from '@/lib/jobs/base-job-service';
import { TextExtractor } from '@/lib/analyze/text-extractor';
import { SimplePricePerPieceEvaluator } from '@/lib/analyze/value-evaluator/simple-price-per-piece';
import type { JobType } from '@/lib/types';
import type { Database, Json } from '@/lib/supabase/supabase.types';

const BATCH_SIZE = 100; // Process 100 listings per step to avoid timeout

interface AnalyzeJobEvent {
  name: 'job/analyze.triggered';
  data: {
    listingIds?: string[];
    limit?: number;
  };
}

import { INNGEST_FUNCTION_IDS } from './registry';

export const analyzeJob = inngest.createFunction(
  { id: INNGEST_FUNCTION_IDS.ANALYZE_JOB },
  { event: 'job/analyze.triggered' },
  async ({ event, step }) => {
    const { listingIds, limit, datasetId } = event.data;

    // Step 1: Create job record
    const job = await step.run('create-job', async () => {
      const jobService = new BaseJobService(supabaseServer);
      const metadata: Record<string, unknown> = {
        listingIds: listingIds || null,
        limit: limit || null,
      };
      
      return await jobService.createJob(
        'analyze_listings' as JobType,
        'all', // Marketplace doesn't really apply to analysis
        metadata,
        datasetId
      );
    });

    const jobId = job.id;

    // Step 2: Initialize analyzers
    const textExtractor = new TextExtractor();
    const valueEvaluator = new SimplePricePerPieceEvaluator();

    // Step 3: Get listings to analyze
    let listingIdsToAnalyze: string[];

    // If dataset_id is provided and listingIds is not provided, get listing IDs from dataset
    let resolvedListingIds = listingIds;
    if (datasetId && (!listingIds || listingIds.length === 0)) {
      const datasetListingIds = await step.run('get-dataset-listing-ids', async () => {
        const { data: datasetListings, error: datasetError } = await supabaseServer
          .schema('public')
          .from('dataset_listings')
          .select('listing_id')
          .eq('dataset_id', datasetId);

        if (datasetError) {
          throw new Error(`Failed to get dataset listings: ${datasetError.message}`);
        }

        return datasetListings ? datasetListings.map(dl => dl.listing_id) : [];
      });
      
      if (datasetListingIds.length > 0) {
        resolvedListingIds = datasetListingIds;
      } else {
        // No listings in dataset, return empty
        resolvedListingIds = [];
      }
    }

    if (resolvedListingIds && resolvedListingIds.length > 0) {
      // Use provided listing IDs (or dataset listing IDs)
      listingIdsToAnalyze = resolvedListingIds;

      await step.run('update-progress-found', async () => {
        const jobService = new BaseJobService(supabaseServer);
        await jobService.updateJobProgress(
          jobId,
          `Found ${resolvedListingIds.length} listings to analyze...`,
          { listings_found: resolvedListingIds.length }
        );
      });
    } else {
      // Find unanalyzed listings
      await step.run('update-progress-finding', async () => {
        const jobService = new BaseJobService(supabaseServer);
        await jobService.updateJobProgress(jobId, 'Finding unanalyzed listings...');
      });

      listingIdsToAnalyze = await step.run('find-unanalyzed', async () => {
        // Get all listing IDs that already have analysis
        const { data: analyzedListings, error: analyzedError } = await supabaseServer
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

        // Fetch all active listings (no limit by default)
        // If limit is provided, use it; otherwise fetch all
        let query = supabaseServer
          .schema('pipeline')
          .from('listings')
          .select('id')
          .eq('status', 'active');

        // Filter by dataset if provided
        if (datasetId) {
          const { data: datasetListings, error: datasetError } = await supabaseServer
            .schema('public')
            .from('dataset_listings')
            .select('listing_id')
            .eq('dataset_id', datasetId);

          if (datasetError) {
            throw new Error(`Failed to get dataset listings: ${datasetError.message}`);
          }

          if (datasetListings && datasetListings.length > 0) {
            const datasetListingIds = datasetListings.map(dl => dl.listing_id);
            query = query.in('id', datasetListingIds);
          } else {
            // No listings in dataset, return empty
            return [];
          }
        }

        // Only apply limit if explicitly provided
        if (limit) {
          query = query.limit(limit);
        }

        const { data: allListings, error } = await query;

        if (error) {
          throw new Error(`Failed to fetch listings: ${error.message}`);
        }

        if (!allListings || allListings.length === 0) {
          return [];
        }

        // Filter out listings that already have analysis
        const unanalyzedListings = allListings.filter(
          (listing) => !analyzedListingIds.has(listing.id)
        );

        // If limit was provided, respect it; otherwise return all unanalyzed
        if (limit) {
          return unanalyzedListings.slice(0, limit).map((l) => l.id);
        }

        return unanalyzedListings.map((l) => l.id);
      });

      if (listingIdsToAnalyze.length === 0) {
        await step.run('complete-job-no-work', async () => {
          const jobService = new BaseJobService(supabaseServer);
          await jobService.completeJob(
            jobId,
            { listings_found: 0, listings_new: 0, listings_updated: 0 },
            'No listings found to analyze'
          );
        });
        return {
          jobId,
          total: 0,
          succeeded: 0,
          failed: 0,
          errors: [],
        };
      }

      await step.run('update-progress-found', async () => {
        const jobService = new BaseJobService(supabaseServer);
        await jobService.updateJobProgress(
          jobId,
          `Found ${listingIdsToAnalyze.length} listings to analyze...`,
          { listings_found: listingIdsToAnalyze.length }
        );
      });
    }

    // Step 4: Process listings in batches
    const result = {
      succeeded: 0,
      failed: 0,
      errors: [] as Array<{ listingId: string; error: string }>,
    };

    const batches = Math.ceil(listingIdsToAnalyze.length / BATCH_SIZE);

    for (let i = 0; i < batches; i++) {
      const start = i * BATCH_SIZE;
      const end = Math.min(start + BATCH_SIZE, listingIdsToAnalyze.length);
      const batch = listingIdsToAnalyze.slice(start, end);

      // Process batch
      const batchResult = await step.run(`process-batch-${i}`, async () => {
        const batchStats = {
          succeeded: 0,
          failed: 0,
          errors: [] as Array<{ listingId: string; error: string }>,
        };

        for (const listingId of batch) {
          try {
            // Fetch the listing
            const { data: listing, error: listingError } = await supabaseServer
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
            const extractedData = textExtractor.extractAll(text);

            // Calculate price per piece if we have both price and piece count
            let pricePerPiece: number | null = null;
            if (listing.price && extractedData.piece_count) {
              pricePerPiece = listing.price / extractedData.piece_count;
            }

            // Create analysis record
            const analysis = {
              listing_id: listingId,
              piece_count: extractedData.piece_count,
              estimated_piece_count: extractedData.estimated_piece_count, // boolean
              minifig_count: extractedData.minifig_count,
              estimated_minifig_count: extractedData.estimated_minifig_count, // boolean
              condition: extractedData.condition,
              price_per_piece: pricePerPiece,
              analysis_metadata: extractedData.metadata as Json,
              analysis_version: '1.0.0',
              analyzed_at: new Date().toISOString(),
            };

            // Check if analysis already exists
            const { data: existingAnalysis } = await supabaseServer
              .schema('pipeline')
              .from('listing_analysis')
              .select('id')
              .eq('listing_id', listingId)
              .maybeSingle();

            if (existingAnalysis) {
              // Update existing analysis
              const { error: updateError } = await supabaseServer
                .schema('pipeline')
                .from('listing_analysis')
                .update({
                  ...analysis,
                  analyzed_at: new Date().toISOString(),
                })
                .eq('id', existingAnalysis.id);

              if (updateError) {
                throw new Error(`Failed to update analysis: ${updateError.message}`);
              }
            } else {
              // Insert new analysis
              const { error: insertError } = await supabaseServer
                .schema('pipeline')
                .from('listing_analysis')
                .insert(analysis);

              if (insertError) {
                throw new Error(`Failed to insert analysis: ${insertError.message}`);
              }
            }

            batchStats.succeeded++;
          } catch (error) {
            batchStats.failed++;
            const errorMessage =
              error instanceof Error ? error.message : 'Unknown error';
            batchStats.errors.push({
              listingId,
              error: errorMessage,
            });
            console.error(`Error analyzing listing ${listingId}:`, errorMessage);
          }
        }

        return batchStats;
      });

      result.succeeded += batchResult.succeeded;
      result.failed += batchResult.failed;
      result.errors.push(...batchResult.errors);

      // Update progress after each batch
      await step.run(`update-progress-batch-${i}`, async () => {
        const jobService = new BaseJobService(supabaseServer);
        await jobService.updateJobProgress(
          jobId,
          `Analyzing listing ${(i + 1) * BATCH_SIZE} of ${listingIdsToAnalyze.length}...`,
          {
            listings_found: listingIdsToAnalyze.length,
            listings_new: result.succeeded,
            listings_updated: result.failed,
          }
        );
      });
    }

    // Step 5: Complete or fail job
    const finalStatus = result.failed === listingIdsToAnalyze.length ? 'failed' : 'completed';
    const finalMessage =
      result.failed > 0 && result.succeeded === 0
        ? `All ${listingIdsToAnalyze.length} listings failed to analyze`
        : result.failed > 0
        ? `Completed: ${result.succeeded} analyzed successfully, ${result.failed} failed`
        : `Completed: ${result.succeeded} listings analyzed successfully`;

    await step.run('complete-job', async () => {
      const jobService = new BaseJobService(supabaseServer);
      if (finalStatus === 'failed') {
        await jobService.failJob(
          jobId,
          result.failed > 0 && result.succeeded === 0
            ? `All ${listingIdsToAnalyze.length} listings failed to analyze`
            : `${result.failed} of ${listingIdsToAnalyze.length} listings failed to analyze`
        );
      } else {
        await jobService.completeJob(
          jobId,
          {
            listings_found: listingIdsToAnalyze.length,
            listings_new: result.succeeded,
            listings_updated: result.failed,
          },
          finalMessage
        );
      }
    });

    return {
      jobId,
      total: listingIdsToAnalyze.length,
      succeeded: result.succeeded,
      failed: result.failed,
      errors: result.errors,
    };
  }
);

