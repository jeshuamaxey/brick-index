// Base interface for value evaluators

import type { Listing, ListingAnalysis, ValueScore } from '@/lib/types';

export interface ValueEvaluator {
  /**
   * Get the name/identifier of this evaluator
   */
  getName(): string;

  /**
   * Evaluate the value of a listing based on its analysis
   * @param listing - The listing to evaluate
   * @param analysis - The analysis results for the listing
   * @returns A value score with confidence level
   */
  evaluate(listing: Listing, analysis: ListingAnalysis): ValueScore;
}

