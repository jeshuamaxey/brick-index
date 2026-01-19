// API route to get a single job by ID
// For reconcile jobs, enriches response with listing data grouped by listing

import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';
import type { Database } from '@/lib/supabase/supabase.types';

interface ExtractedIdEntry {
  extractedId: string;
  listingId: string;
}

interface ReconcileJobMetadata {
  reconciliationVersion?: string;
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

      // Fetch listings for all unique listing IDs
      // Batch queries to avoid URI too long errors
      const listingIds = Array.from(listingIdMap.keys());
      const listings: Array<{
        listingId: string;
        title: string;
        description: string | null;
        sanitisedTitle: string | null;
        sanitisedDescription: string | null;
        extractedIds: Array<{ extractedId: string; validated: boolean }>;
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
            // Map listings to the enriched format
            for (const listing of listingsData) {
              const extractedIds = listingIdMap.get(listing.id) || [];
              listings.push({
                listingId: listing.id,
                title: listing.title || '',
                description: listing.description,
                sanitisedTitle: listing.sanitised_title || null,
                sanitisedDescription: listing.sanitised_description || null,
                extractedIds,
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
