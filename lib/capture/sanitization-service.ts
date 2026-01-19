// Service to sanitize HTML markup from listing text fields

import { convert } from 'html-to-text';
import type { Listing } from '@/lib/types';

export class SanitizationService {
  /**
   * Normalize whitespace in text, condensing multiple consecutive newlines
   * to at most one blank line (two newlines)
   * @param text - Text to normalize
   * @returns Normalized text
   */
  private normalizeWhitespace(text: string): string {
    // Collapse 3+ consecutive newlines into just 2 newlines (one blank line)
    // This regex matches 3 or more newlines (including \r\n, \n, or \r)
    return text.replace(/(\r?\n){3,}/g, '\n\n');
  }

  /**
   * Sanitize HTML markup from text, removing all tags and non-textual content
   * @param html - HTML string or null
   * @returns Sanitised plain text or null if input was null/empty
   */
  sanitizeText(html: string | null): string | null {
    // Return null if input is null or empty
    if (!html || html.trim().length === 0) {
      return null;
    }

    try {
      // Convert HTML to plain text
      // html-to-text automatically:
      // - Removes all HTML tags (divs, p-tags, etc.)
      // - Removes images, SVGs, scripts, styles, CSS
      // - Extracts text content from visible elements
      // - Handles plain text gracefully (no-op if no HTML)
      const text = convert(html, {
        wordwrap: false, // No line wrapping
        preserveNewlines: true, // Keep line breaks and paragraph spacing
        // Use default formatters and selectors which handle all tags appropriately
      });

      // Post-process to normalize whitespace (condense multiple newlines)
      const normalized = this.normalizeWhitespace(text);

      // Trim whitespace and return null if result is empty
      const trimmed = normalized.trim();
      return trimmed.length > 0 ? trimmed : null;
    } catch (error) {
      // If conversion fails (malformed HTML, etc.), log and return null
      console.error('Error sanitizing text:', error);
      return null;
    }
  }

  /**
   * Sanitize title and description fields from a listing
   * @param listing - Listing object with title and description
   * @returns Object with sanitised_title and sanitised_description
   */
  sanitizeListing(listing: Listing): {
    sanitised_title: string | null;
    sanitised_description: string | null;
  } {
    return {
      sanitised_title: this.sanitizeText(listing.title),
      sanitised_description: this.sanitizeText(listing.description),
    };
  }
}
