// Simple price-per-piece value evaluator

import type { Listing, ListingAnalysis, ValueScore } from '@/lib/types';
import type { ValueEvaluator } from './base-evaluator';

export class SimplePricePerPieceEvaluator implements ValueEvaluator {
  getName(): string {
    return 'simple-price-per-piece';
  }

  evaluate(listing: Listing, analysis: ListingAnalysis): ValueScore {
    // If we don't have piece count or price, we can't calculate
    if (!analysis.piece_count || !listing.price) {
      return {
        score: null,
        confidence: 0,
      };
    }

    // Calculate price per piece
    const pricePerPiece = listing.price / analysis.piece_count;

    // Confidence is lower if piece count is estimated
    const confidence = analysis.estimated_piece_count ? 0.7 : 1.0;

    return {
      score: pricePerPiece,
      confidence,
    };
  }
}

