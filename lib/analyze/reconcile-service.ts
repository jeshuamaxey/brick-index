// Service to orchestrate LEGO ID extraction, validation, and join creation

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/supabase.types';
import { TextExtractor } from './text-extractor';
import { LegoSetValidator, type ValidatedSetInfo } from './lego-set-validator';
import { LegoSetJoinsService } from './lego-set-joins-service';
import { createServiceLogger, type AppLogger } from '@/lib/logging';

export interface ProcessingResult {
  extracted: number;
  validated: number;
  joinsCreated: number;
}

export class ReconcileService {
  // Current reconciliation algorithm version (semantic versioning: MAJOR.MINOR.PATCH)
  public static readonly RECONCILIATION_VERSION = '1.2.0';

  private textExtractor: TextExtractor;
  private validator: LegoSetValidator;
  private joinsService: LegoSetJoinsService;
  private log: AppLogger;

  constructor(private supabase: SupabaseClient<Database>, parentLogger?: AppLogger) {
    this.textExtractor = new TextExtractor();
    this.validator = new LegoSetValidator(supabase);
    this.joinsService = new LegoSetJoinsService(supabase);
    this.log = parentLogger 
      ? parentLogger.child({ service: 'ReconcileService' })
      : createServiceLogger('ReconcileService');
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
    // Fetch the listing
    const { data: listing, error: listingError } = await this.supabase
      .schema('pipeline')
      .from('listings')
      .select('*')
      .eq('id', listingId)
      .single();

    if (listingError || !listing) {
      this.log.error({ err: listingError, listingId }, 'Error fetching listing');
      throw new Error(
        `Listing not found: ${listingError?.message || 'Unknown error'}`
      );
    }

    // Combine sanitised title and description for extraction
    // Only use sanitised fields - do not use regular title/description
    const text = [listing.sanitised_title, listing.sanitised_description]
      .filter(Boolean)
      .join(' ');

    // Extract LEGO set IDs from text using the reconciliation version
    const extractedSetIds = this.textExtractor.extractLegoSetIds(text, reconciliationVersion);
    const extractedCount = extractedSetIds.length;

    // Mark listing as reconciled (even if no LEGO sets found)
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
      this.log.error({ err: updateError, listingId }, 'Error marking listing as reconciled');
      throw new Error(
        `Failed to mark listing as reconciled: ${updateError.message}`
      );
    }

    if (extractedCount === 0) {
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
    const validatedMap = await this.validator.validateSetIds(extractedSetIds);

    // Separate validated and not validated IDs with listing ID
    const validatedIds: Array<{ extractedId: string; listingId: string }> = [];
    const notValidatedIds: Array<{ extractedId: string; listingId: string }> = [];
    
    for (const [extractedId, validatedInfo] of validatedMap.entries()) {
      if (validatedInfo.legoSetId !== null) {
        validatedIds.push({ extractedId, listingId });
      } else {
        notValidatedIds.push({ extractedId, listingId });
      }
    }

    // Count validated IDs (non-null values)
    const validatedCount = validatedIds.length;

    // Create join records for validated sets
    // Convert Map<string, ValidatedSetInfo> to Map<string, { legoSetId: string, setNum: string }> for createJoins
    const validatedSetIdsMap = new Map<string, { legoSetId: string; setNum: string }>();
    for (const [extractedId, validatedInfo] of validatedMap.entries()) {
      if (validatedInfo.legoSetId !== null && validatedInfo.setNum !== null) {
        validatedSetIdsMap.set(extractedId, {
          legoSetId: validatedInfo.legoSetId,
          setNum: validatedInfo.setNum,
        });
      }
    }

    try {
      await this.joinsService.createJoins(
        listingId,
        validatedSetIdsMap,
        reconciliationVersion,
        'mentioned',
        cleanupMode
      );
    } catch (error) {
      this.log.error({ err: error, listingId }, 'Error creating join records');
      throw error;
    }

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
        this.log.warn({ err: error, listingId }, 'Error processing listing (continuing)');
      }
    }

    return result;
  }
}
