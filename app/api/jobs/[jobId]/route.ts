// API route to get a single job by ID
// For reconcile jobs, enriches response with listing data grouped by listing

import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';
import type { Database } from '@/lib/supabase/supabase.types';

interface ExtractedIdEntry {
  extractedId: string;
  listingId: string;
}

interface ListingValidatedSet {
  legoSetId: string;
  setNum: string;
  name: string;
}

interface ReconcileJobMetadata {
  reconciliationVersion?: string;
  processed_listing_ids?: string[]; // All processed listing IDs (including zero extracted IDs)
  extracted_ids?: {
    validated_ids?: ExtractedIdEntry[];
    not_validated_ids?: ExtractedIdEntry[];
  };
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ jobId: string }> }
) {
  try {
    const { jobId } = await context.params;

    // Fetch job
    const { data: job, error: jobError } = await supabaseServer
      .schema('pipeline')
      .from('jobs')
      .select('*')
      .eq('id', jobId)
      .single();

    if (jobError) {
      return NextResponse.json(
        { error: jobError.message },
        { status: jobError.code === 'PGRST116' ? 404 : 500 }
      );
    }

    if (!job) {
      return NextResponse.json(
        { error: 'Job not found' },
        { status: 404 }
      );
    }

    // For reconcile jobs, enrich with listing data
    if (job.type === 'reconcile') {
      const metadata = job.metadata as ReconcileJobMetadata | null;
      const reconciliationVersion = metadata?.reconciliationVersion || '1.0.0';
      
      // Get all extracted IDs from metadata
      const validatedIds = metadata?.extracted_ids?.validated_ids || [];
      const notValidatedIds = metadata?.extracted_ids?.not_validated_ids || [];
      const allExtractedIds = [...validatedIds, ...notValidatedIds];

      // Group by listingId
      const listingIdMap = new Map<string, Array<{ extractedId: string; validated: boolean }>>();
      
      for (const entry of validatedIds) {
        if (!listingIdMap.has(entry.listingId)) {
          listingIdMap.set(entry.listingId, []);
        }
        listingIdMap.get(entry.listingId)!.push({
          extractedId: entry.extractedId,
          validated: true,
        });
      }

      for (const entry of notValidatedIds) {
        if (!listingIdMap.has(entry.listingId)) {
          listingIdMap.set(entry.listingId, []);
        }
        listingIdMap.get(entry.listingId)!.push({
          extractedId: entry.extractedId,
          validated: false,
        });
      }

      // Get all processed listing IDs from metadata (including ones with zero extracted IDs)
      // Fall back to listing IDs from extracted_ids if processed_listing_ids is not available (for older jobs)
      const processedListingIds = metadata?.processed_listing_ids || Array.from(listingIdMap.keys());
      
      // Fetch listings for all processed listing IDs
      // Batch queries to avoid URI too long errors
      const listingIds = processedListingIds;
      const listings: Array<{
        listingId: string;
        // Basic listing fields
        title: string;
        description: string | null;
        sanitisedTitle: string | null;
        sanitisedDescription: string | null;
        // Extracted IDs from regex + validation metadata
        extractedIds: Array<{ extractedId: string; validated: boolean }>;
        // Validated LEGO sets joined from catalog
        validatedSets: ListingValidatedSet[];
      }> = [];

      if (listingIds.length > 0) {
        // Batch size to avoid URI length limits (PostgREST has limits on query string length)
        const BATCH_SIZE = 100;
        const batches: string[][] = [];
        
        for (let i = 0; i < listingIds.length; i += BATCH_SIZE) {
          batches.push(listingIds.slice(i, i + BATCH_SIZE));
        }

        // Fetch listings in batches
        for (const batch of batches) {
          // Fetch listing rows
          const { data: listingsData, error: listingsError } = await supabaseServer
            .schema('pipeline')
            .from('listings')
            .select('id, title, description, sanitised_title, sanitised_description')
            .in('id', batch);

          if (listingsError) {
            console.error('Error fetching listings batch:', listingsError);
            // Continue with other batches rather than failing completely
            continue;
          }

          if (listingsData) {
            // Fetch validated joins for this batch of listings
            const { data: joinsData, error: joinsError } = await supabaseServer
              .schema('pipeline')
              .from('listing_lego_set_joins')
              .select('listing_id, lego_set_id')
              .in('listing_id', batch)
              .eq('status', 'active');

            if (joinsError) {
              console.error('Error fetching listing_lego_set_joins batch:', joinsError);
            }

            // Build map of listing_id -> lego_set_ids[]
            const listingToLegoSetIds = new Map<string, string[]>();
            const legoSetIds = new Set<string>();

            for (const join of joinsData || []) {
              legoSetIds.add(join.lego_set_id);
              const existing = listingToLegoSetIds.get(join.listing_id) || [];
              existing.push(join.lego_set_id);
              listingToLegoSetIds.set(join.listing_id, existing);
            }

            // Fetch LEGO set details (set_num, name) for all lego_set_ids in this batch
            const legoSetDetailsMap = new Map<string, { setNum: string; name: string }>();

            if (legoSetIds.size > 0) {
              const { data: legoSetsData, error: legoSetsError } = await supabaseServer
                .schema('catalog')
                .from('lego_sets')
                .select('id, set_num, name')
                .in('id', Array.from(legoSetIds));

              if (legoSetsError) {
                console.error('Error fetching lego_sets for joins batch:', legoSetsError);
              } else {
                for (const set of legoSetsData || []) {
                  legoSetDetailsMap.set(set.id, {
                    setNum: set.set_num,
                    name: set.name,
                  });
                }
              }
            }

            // Map listings to the enriched format
            for (const listing of listingsData) {
              // Get extracted IDs for this listing (empty array if none)
              const extractedIds = listingIdMap.get(listing.id) || [];
              // Get validated LEGO sets for this listing by looking up joins + lego_sets
              const legoSetIdsForListing = listingToLegoSetIds.get(listing.id) || [];
              const validatedSets: ListingValidatedSet[] = legoSetIdsForListing
                .map((legoSetId) => {
                  const details = legoSetDetailsMap.get(legoSetId);
                  if (!details) {
                    return null;
                  }
                  return {
                    legoSetId,
                    setNum: details.setNum,
                    name: details.name,
                  };
                })
                .filter((v): v is ListingValidatedSet => v !== null);

              listings.push({
                listingId: listing.id,
                title: listing.title || '',
                description: listing.description,
                sanitisedTitle: listing.sanitised_title || null,
                sanitisedDescription: listing.sanitised_description || null,
                extractedIds,
                validatedSets,
              });
            }
          }
        }
      }

      return NextResponse.json({
        job: {
          ...job,
          reconciliationVersion,
        },
        listings,
      });
    }

    // For non-reconcile jobs, return standard job data
    return NextResponse.json({ job });
  } catch (error) {
    console.error('Error fetching job:', error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'Unknown error occurred',
      },
      { status: 500 }
    );
  }
}
