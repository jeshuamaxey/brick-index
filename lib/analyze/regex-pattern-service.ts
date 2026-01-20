// Service to map reconciliation versions to regex patterns for LEGO set ID extraction

/**
 * Regex pattern for extracting LEGO set IDs from text
 * Pattern: (?<!\d\.)\b\d{3,7}(-\d{1,2})?\b(?!%)
 * - (?<!\d\.) - Negative lookbehind to exclude matches preceded by digit-period (e.g., "9.344" won't match "344")
 * - \b - Word boundaries to avoid matching partial numbers
 * - \d{3,7} - Main set number (3-7 digits)
 * - (-\d{1,2})? - Optional version suffix (dash + 1-2 digits)
 * - \b - Word boundary
 * - (?!%) - Negative lookahead to exclude matches followed by "%" (e.g., "100%")
 */
export const DEFAULT_LEGO_SET_ID_PATTERN = /(?<!\d\.)\b\d{3,7}(-\d{1,2})?\b(?!%)/g;

/**
 * Mapping of reconciliation versions to their regex patterns
 * This allows us to use different regex patterns for different versions
 * and to display the correct pattern in the UI based on the job's version
 */
const VERSION_TO_PATTERN: Record<string, RegExp> = {
  '1.0.0': /\b\d{3,7}(-\d{1,2})?\b/g, // Original pattern without % exclusion
  '1.1.0': /\b\d{3,7}(-\d{1,2})?\b(?!%)/g, // Pattern with % exclusion
  '1.2.0': DEFAULT_LEGO_SET_ID_PATTERN, // Pattern with % exclusion and decimal exclusion
};

export class RegexPatternService {
  /**
   * Get the regex pattern for a given reconciliation version
   * @param version - Reconciliation version (e.g., "1.0.0")
   * @returns RegExp pattern for extracting LEGO set IDs
   */
  static getRegexPattern(version: string): RegExp {
    const pattern = VERSION_TO_PATTERN[version];
    if (pattern) {
      // Create a new RegExp to avoid issues with global flag state
      return new RegExp(pattern.source, pattern.flags);
    }
    
    // Default to current pattern if version not found
    return new RegExp(DEFAULT_LEGO_SET_ID_PATTERN.source, DEFAULT_LEGO_SET_ID_PATTERN.flags);
  }

  /**
   * Get the default/current regex pattern
   * @returns RegExp pattern for the current version
   */
  static getDefaultPattern(): RegExp {
    return new RegExp(DEFAULT_LEGO_SET_ID_PATTERN.source, DEFAULT_LEGO_SET_ID_PATTERN.flags);
  }
}
