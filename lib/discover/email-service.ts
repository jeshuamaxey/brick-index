// Service to send email alerts via Resend

import { Resend } from 'resend';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/supabase.types';
import type { Search, Listing, ListingAnalysis } from '@/lib/types';

export class EmailService {
  private resend: Resend;

  constructor(
    private supabase: SupabaseClient<Database>,
    apiKey?: string
  ) {
    const key = apiKey || process.env.RESEND_API_KEY;
    if (!key) {
      throw new Error('RESEND_API_KEY environment variable is required');
    }
    this.resend = new Resend(key);
  }

  /**
   * Send email alert for a search with matching listings
   * @param search - The search configuration
   * @param listings - Array of listings with their analyses
   * @param userEmail - The user's email address (should be passed from API route that has access to auth)
   * @returns true if email was sent successfully
   */
  async sendSearchAlert(
    search: Search,
    listings: Array<{ listing: Listing; analysis: ListingAnalysis | null }>,
    userEmail: string
  ): Promise<boolean> {
    if (!userEmail) {
      console.error(`User email not provided for search ${search.id}`);
      return false;
    }

    const email = userEmail;

    // Build email content
    const subject = `New LEGO Deals Found for "${search.name}"`;
    const html = this.buildEmailHtml(search, listings);

    try {
      const { error } = await this.resend.emails.send({
        from: process.env.RESEND_FROM_EMAIL || 'noreply@example.com',
        to: email,
        subject,
        html,
      });

      if (error) {
        console.error('Error sending email:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Exception sending email:', error);
      return false;
    }
  }

  /**
   * Build HTML email content
   */
  private buildEmailHtml(
    search: Search,
    listings: Array<{ listing: Listing; analysis: ListingAnalysis | null }>
  ): string {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

    let listingsHtml = '';
    for (const { listing, analysis } of listings) {
      const price = listing.price
        ? `${listing.currency || '$'}${listing.price.toFixed(2)}`
        : 'N/A';
      const pricePerPiece = analysis?.price_per_piece
        ? `$${analysis.price_per_piece.toFixed(4)}`
        : 'N/A';
      const pieces = analysis?.piece_count ?? 'Unknown';
      const minifigs = analysis?.minifig_count ?? 'Unknown';

      listingsHtml += `
        <div style="border: 1px solid #ddd; padding: 15px; margin-bottom: 15px; border-radius: 5px;">
          <h3 style="margin-top: 0;">
            <a href="${listing.url}" style="color: #2563eb; text-decoration: none;">
              ${this.escapeHtml(listing.title)}
            </a>
          </h3>
          <p><strong>Price:</strong> ${price}</p>
          <p><strong>Price per piece:</strong> ${pricePerPiece}</p>
          <p><strong>Pieces:</strong> ${pieces}</p>
          <p><strong>Minifigs:</strong> ${minifigs}</p>
          <p><strong>Marketplace:</strong> ${listing.marketplace}</p>
          <p>
            <a href="${listing.url}" style="color: #2563eb; text-decoration: none;">
              View on ${listing.marketplace} →
            </a>
          </p>
        </div>
      `;
    }

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #2563eb; color: white; padding: 20px; border-radius: 5px 5px 0 0; }
            .content { background-color: #f9fafb; padding: 20px; border-radius: 0 0 5px 5px; }
            .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1 style="margin: 0;">New LEGO Deals Found!</h1>
            </div>
            <div class="content">
              <p>We found <strong>${listings.length}</strong> new listing(s) matching your search "<strong>${this.escapeHtml(search.name)}</strong>":</p>
              ${listingsHtml}
              <p style="margin-top: 20px;">
                <a href="${appUrl}/searches/${search.id}" style="background-color: #2563eb; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">
                  View All Matches
                </a>
              </p>
            </div>
            <div class="footer">
              <p>You're receiving this because you have email alerts enabled for this search.</p>
              <p><a href="${appUrl}/searches/${search.id}/settings">Manage your search settings</a></p>
            </div>
          </div>
        </body>
      </html>
    `;
  }

  /**
   * Escape HTML special characters
   */
  private escapeHtml(text: string): string {
    const map: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;',
    };
    return text.replace(/[&<>"']/g, (m) => map[m]);
  }

  /**
   * Mark search results as notified
   * @param searchId - The search ID
   * @param listingIds - Array of listing IDs that were notified
   */
  async markAsNotified(
    searchId: string,
    listingIds: string[]
  ): Promise<void> {
    await this.supabase
      .from('search_results')
      .update({ notified_at: new Date().toISOString() })
      .eq('search_id', searchId)
      .in('listing_id', listingIds);
  }
}

