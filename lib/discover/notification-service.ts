// Service to orchestrate matching and notifications

import type { SupabaseClient } from '@supabase/supabase-js';
import { MatchingService } from './matching-service';
import { EmailService } from './email-service';
import type { Listing, ListingAnalysis } from '@/lib/types';

export class NotificationService {
  private matchingService: MatchingService;
  private emailService: EmailService;
  private supabase: SupabaseClient;

  constructor(supabase: SupabaseClient, resendApiKey?: string) {
    this.supabase = supabase;
    this.matchingService = new MatchingService(supabase);
    this.emailService = new EmailService(supabase, resendApiKey);
  }

  /**
   * Process notifications for all searches
   * Matches listings to searches and sends emails for new matches
   * @param listingIds - Optional array of listing IDs to process (if not provided, processes all)
   * @returns Number of emails sent
   */
  async processNotifications(listingIds?: string[]): Promise<number> {
    // Match all searches
    const matches = await this.matchingService.matchAllSearches(listingIds);

    let emailsSent = 0;

    // Process each search
    for (const [searchId, matchingListingIds] of matches.entries()) {
      // Store search results (only new matches)
      await this.matchingService.storeSearchResults(
        searchId,
        matchingListingIds
      );

      // Get search details
      const { data: search } = await this.supabase
        .from('searches')
        .select('*')
        .eq('id', searchId)
        .single();

      if (!search || !search.email_alerts_enabled) {
        continue;
      }

      // Get user email from auth.users using service role
      // Note: This requires SUPABASE_SERVICE_ROLE_KEY to be set
      let userEmail: string | null = null;
      try {
        // Try to get user email - this requires service role key
        const { data: userData, error: userError } =
          await this.supabase.auth.admin.getUserById(search.profile_id);
        if (!userError && userData?.user?.email) {
          userEmail = userData.user.email;
        }
      } catch (error) {
        // If admin API is not available, we can't send emails
        console.warn(
          `Cannot get user email for search ${searchId}:`,
          error
        );
        continue;
      }

      if (!userEmail) {
        console.warn(`User email not available for search ${searchId}`);
        continue;
      }

      // Get listings that haven't been notified yet
      const { data: searchResults } = await this.supabase
        .from('search_results')
        .select('listing_id')
        .eq('search_id', searchId)
        .is('notified_at', null)
        .in('listing_id', matchingListingIds);

      if (!searchResults || searchResults.length === 0) {
        continue;
      }

      const unnotifiedListingIds = searchResults.map((r) => r.listing_id);

      // Fetch listing details with analyses
      const { data: listings } = await this.supabase
        .schema('pipeline')
        .from('listings')
        .select('*, listing_analysis(*)')
        .in('id', unnotifiedListingIds);

      if (!listings || listings.length === 0) {
        continue;
      }

      // Prepare listings with analyses
      const listingsWithAnalyses = listings.map((listing) => ({
        listing: listing as Listing,
        analysis: (listing.listing_analysis as ListingAnalysis[])?.[0] || null,
      }));

      // Send email
      const sent = await this.emailService.sendSearchAlert(
        search as any,
        listingsWithAnalyses,
        userEmail
      );

      if (sent) {
        // Mark as notified
        await this.emailService.markAsNotified(
          searchId,
          unnotifiedListingIds
        );
        emailsSent++;
      }
    }

    return emailsSent;
  }
}

