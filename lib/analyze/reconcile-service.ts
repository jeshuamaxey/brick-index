// Service to orchestrate LEGO ID extraction, validation, and join creation

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/supabase.types';
import { TextExtractor } from './text-extractor';
import { LegoSetValidator } from './lego-set-validator';
import { LegoSetJoinsService } from './lego-set-joins-service';

export interface ProcessingResult {
  extracted: number;
  validated: number;
  joinsCreated: number;
}

export class ReconcileService {
  // Current reconciliation algorithm version (semantic versioning: MAJOR.MINOR.PATCH)
  public static readonly RECONCILIATION_VERSION = '1.0.0';

  private textExtractor: TextExtractor;
  private validator: LegoSetValidator;
  private joinsService: LegoSetJoinsService;

  constructor(private supabase: SupabaseClient<Database>) {
    this.textExtractor = new TextExtractor();
    this.validator = new LegoSetValidator(supabase);
    this.joinsService = new LegoSetJoinsService(supabase);
  }

  /**
   * Process a single listing: extract, validate, and create joins
   * @param listingId - The listing ID to process
   * @param reconciliationVersion - Version of reconciliation algorithm (default: current version)
   * @param cleanupMode - How to handle existing joins (default: 'supersede')
   * @returns Statistics about the processing, including the count of extracted IDs
   */
  async processListing(
    listingId: string,
    reconciliationVersion: string = ReconcileService.RECONCILIATION_VERSION,
    cleanupMode: 'delete' | 'supersede' | 'keep' = 'supersede'
  ): Promise<{ 
    extracted: number; 
    validated: number; 
    joinsCreated: number;
    extractedCount: number; // Number of IDs extracted from this listing
    extractedIds: string[]; // All extracted set IDs
    validatedIds: Array<{ extractedId: string; listingId: string }>; // Extracted set IDs that were validated
    notValidatedIds: Array<{ extractedId: string; listingId: string }>; // Extracted set IDs that were not validated
  }> {
    console.log(`[ReconcileService] Processing listing ${listingId} with version ${reconciliationVersion}, cleanupMode: ${cleanupMode}`);
    
    // Fetch the listing
    console.log(`[ReconcileService] Fetching listing ${listingId} from database...`);
    const { data: listing, error: listingError } = await this.supabase
      .schema('pipeline')
      .from('listings')
      .select('*')
      .eq('id', listingId)
      .single();

    if (listingError || !listing) {
      console.error(`[ReconcileService] Error fetching listing ${listingId}:`, listingError);
      throw new Error(
        `Listing not found: ${listingError?.message || 'Unknown error'}`
      );
    }

    console.log(`[ReconcileService] Listing ${listingId} fetched:`, {
      title: listing.title?.substring(0, 50) + '...',
      hasDescription: !!listing.description,
      descriptionLength: listing.description?.length || 0,
    });

    // Combine title and description for extraction
    const text = [listing.title, listing.description]
      .filter(Boolean)
      .join(' ');

    console.log(`[ReconcileService] Extracting LEGO set IDs from text (length: ${text.length})...`);
    // Extract LEGO set IDs from text
    const extractedSetIds = this.textExtractor.extractLegoSetIds(text);
    const extractedCount = extractedSetIds.length;
    console.log(`[ReconcileService] Extracted ${extractedCount} potential LEGO set IDs:`, extractedSetIds);

    // Mark listing as reconciled (even if no LEGO sets found)
    console.log(`[ReconcileService] Marking listing ${listingId} as reconciled...`);
    const now = new Date().toISOString();
    const { error: updateError } = await this.supabase
      .schema('pipeline')
      .from('listings')
      .update({
        reconciled_at: now,
        reconciliation_version: reconciliationVersion,
        updated_at: now,
      })
      .eq('id', listingId);

    if (updateError) {
      console.error(`[ReconcileService] Error marking listing ${listingId} as reconciled:`, updateError);
      throw new Error(
        `Failed to mark listing as reconciled: ${updateError.message}`
      );
    }

    console.log(`[ReconcileService] Listing ${listingId} marked as reconciled`);

    if (extractedCount === 0) {
      console.log(`[ReconcileService] No LEGO set IDs found for listing ${listingId}, returning early`);
      return {
        extracted: 0,
        validated: 0,
        joinsCreated: 0,
        extractedCount: 0,
        extractedIds: [],
        validatedIds: [],
        notValidatedIds: [],
      };
    }

    // Validate extracted IDs against catalog
    console.log(`[ReconcileService] Validating ${extractedCount} extracted set IDs against catalog...`);
    const validatedMap = await this.validator.validateSetIds(extractedSetIds);

    // Separate validated and not validated IDs with listing ID
    const validatedIds: Array<{ extractedId: string; listingId: string }> = [];
    const notValidatedIds: Array<{ extractedId: string; listingId: string }> = [];
    
    for (const [setNum, legoSetId] of validatedMap.entries()) {
      if (legoSetId !== null) {
        validatedIds.push({ extractedId: setNum, listingId });
      } else {
        notValidatedIds.push({ extractedId: setNum, listingId });
      }
    }

    // Count validated IDs (non-null values)
    const validatedCount = validatedIds.length;
    
    console.log(`[ReconcileService] Validation complete: ${validatedCount} of ${extractedCount} IDs are valid`);

    // Create join records for validated sets
    // Convert Map<string, string | null> to Map<string, string> for createJoins
    const validatedSetIdsMap = new Map<string, string>();
    for (const [setNum, legoSetId] of validatedMap.entries()) {
      if (legoSetId !== null) {
        validatedSetIdsMap.set(setNum, legoSetId);
      }
    }

    console.log(`[ReconcileService] Creating join records for ${validatedSetIdsMap.size} validated LEGO sets...`);
    await this.joinsService.createJoins(
      listingId,
      validatedSetIdsMap,
      reconciliationVersion,
      'mentioned',
      cleanupMode
    );

    console.log(`[ReconcileService] Listing ${listingId} processing complete:`, {
      extracted: extractedCount,
      validated: validatedCount,
      joinsCreated: validatedCount,
    });

    return {
      extracted: extractedCount,
      validated: validatedCount,
      joinsCreated: validatedCount,
      extractedCount: extractedCount,
      extractedIds: extractedSetIds,
      validatedIds: validatedIds,
      notValidatedIds: notValidatedIds,
    };
  }

  /**
   * Process multiple listings in batch
   * @param listingIds - Array of listing IDs to process
   * @param reconciliationVersion - Version of reconciliation algorithm (default: current version)
   * @param cleanupMode - How to handle existing joins (default: 'supersede')
   * @returns Aggregate statistics
   */
  async processListings(
    listingIds: string[],
    reconciliationVersion: string = ReconcileService.RECONCILIATION_VERSION,
    cleanupMode: 'delete' | 'supersede' | 'keep' = 'supersede'
  ): Promise<ProcessingResult> {
    const result: ProcessingResult = {
      extracted: 0,
      validated: 0,
      joinsCreated: 0,
    };

    for (const listingId of listingIds) {
      try {
        const stats = await this.processListing(
          listingId,
          reconciliationVersion,
          cleanupMode
        );
        result.extracted += stats.extracted;
        result.validated += stats.validated;
        result.joinsCreated += stats.joinsCreated;
      } catch (error) {
        // Log error but continue processing other listings
        console.error(`Error processing listing ${listingId}:`, error);
      }
    }

    return result;
  }
}
