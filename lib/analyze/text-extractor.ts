// Extract information from listing text (title and description)

import type { ExtractedData } from '@/lib/types';

export class TextExtractor {
  /**
   * Extract piece count from text
   * Looks for patterns like "500 pieces", "1000 pcs", "2000 bricks"
   */
  extractPieceCount(text: string): {
    count: number | null;
    estimated: boolean;
  } {
    if (!text) {
      return { count: null, estimated: false };
    }

    const lowerText = text.toLowerCase();

    // Patterns for estimated counts
    const estimatedPatterns = [
      /(?:~|approx|approximately|about|around|roughly|est\.?|estimated)\s*(\d+)\s*(?:pieces?|pcs?|bricks?)/i,
      /(\d+)\s*(?:pieces?|pcs?|bricks?)\s*(?:~|approx|approximately|about|around|roughly|est\.?|estimated)/i,
    ];

    for (const pattern of estimatedPatterns) {
      const match = text.match(pattern);
      if (match) {
        const count = parseInt(match[1], 10);
        if (!isNaN(count) && count > 0) {
          return { count, estimated: true };
        }
      }
    }

    // Patterns for stated counts
    const statedPatterns = [
      /(\d+)\s*(?:pieces?|pcs?|bricks?)/i,
      /(?:pieces?|pcs?|bricks?):\s*(\d+)/i,
    ];

    for (const pattern of statedPatterns) {
      const match = text.match(pattern);
      if (match) {
        const count = parseInt(match[1], 10);
        if (!isNaN(count) && count > 0) {
          return { count, estimated: false };
        }
      }
    }

    return { count: null, estimated: false };
  }

  /**
   * Extract minifigure count from text
   * Looks for patterns like "5 minifigs", "10 figs", "3 minifigures"
   */
  extractMinifigCount(text: string): {
    count: number | null;
    estimated: boolean;
  } {
    if (!text) {
      return { count: null, estimated: false };
    }

    const lowerText = text.toLowerCase();

    // Patterns for estimated counts
    const estimatedPatterns = [
      /(?:~|approx|approximately|about|around|roughly|est\.?|estimated)\s*(\d+)\s*(?:minifigs?|figs?|minifigures?)/i,
      /(\d+)\s*(?:minifigs?|figs?|minifigures?)\s*(?:~|approx|approximately|about|around|roughly|est\.?|estimated)/i,
    ];

    for (const pattern of estimatedPatterns) {
      const match = text.match(pattern);
      if (match) {
        const count = parseInt(match[1], 10);
        if (!isNaN(count) && count >= 0) {
          return { count, estimated: true };
        }
      }
    }

    // Patterns for stated counts
    const statedPatterns = [
      /(\d+)\s*(?:minifigs?|figs?|minifigures?)/i,
      /(?:minifigs?|figs?|minifigures?):\s*(\d+)/i,
    ];

    for (const pattern of statedPatterns) {
      const match = text.match(pattern);
      if (match) {
        const count = parseInt(match[1], 10);
        if (!isNaN(count) && count >= 0) {
          return { count, estimated: false };
        }
      }
    }

    return { count: null, estimated: false };
  }

  /**
   * Extract condition from text
   */
  extractCondition(text: string): 'new' | 'used' | 'unknown' {
    if (!text) {
      return 'unknown';
    }

    const lowerText = text.toLowerCase();

    // Check for "new" indicators
    if (
      /\b(?:new|sealed|unopened|unused|mint|brand new)\b/i.test(lowerText)
    ) {
      return 'new';
    }

    // Check for "used" indicators
    if (
      /\b(?:used|pre-owned|second hand|previously owned|worn|played with)\b/i.test(
        lowerText
      )
    ) {
      return 'used';
    }

    return 'unknown';
  }

  /**
   * Extract all data from listing text
   */
  extractAll(text: string): ExtractedData {
    const pieceData = this.extractPieceCount(text);
    const minifigData = this.extractMinifigCount(text);
    const condition = this.extractCondition(text);

    return {
      piece_count: pieceData.count,
      estimated_piece_count: pieceData.estimated,
      minifig_count: minifigData.count,
      estimated_minifig_count: minifigData.estimated,
      condition,
      metadata: {
        extraction_method: 'text',
        extracted_at: new Date().toISOString(),
      },
    };
  }
}

