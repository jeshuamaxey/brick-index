// Inngest function for sanitize jobs
// Sanitizes HTML markup from listing title and description fields

import { inngest } from '@/lib/inngest/client';
import { supabaseServer } from '@/lib/supabase/server';
import { BaseJobService } from '@/lib/jobs/base-job-service';
import { SanitizationService } from '@/lib/capture/sanitization-service';
import type { JobType, Listing } from '@/lib/types';

const BATCH_SIZE = 50; // Process 50 items per step to avoid timeout

interface SanitizeJobEvent {
  name: 'job/sanitize.triggered';
  data: {
    listingIds?: string[];
    limit?: number;
  };
}

import { INNGEST_FUNCTION_IDS } from './registry';

export const sanitizeJob = inngest.createFunction(
  { id: INNGEST_FUNCTION_IDS.SANITIZE_JOB },
  { event: 'job/sanitize.triggered' },
  async ({ event, step }) => {
    let jobId: string | null = null;

    try {
      const { listingIds, limit } = event.data;

      // Step 1: Create job record
      const job = await step.run('create-job', async () => {
        const jobService = new BaseJobService(supabaseServer);
        return await jobService.createJob(
          'sanitize_listings' as JobType,
          'all', // Marketplace doesn't really apply to sanitize
          {
            listingIds: listingIds || null,
            limit: limit || null,
          }
        );
      });

      jobId = job.id;

      // Step 2: Update progress - querying
      await step.run('update-progress-querying', async () => {
        const jobService = new BaseJobService(supabaseServer);
        await jobService.updateJobProgress(jobId!, 'Querying listings to sanitize...');
      });

      // Step 3: Query listings to sanitize
      const listings = await step.run('query-listings', async () => {
        let query = supabaseServer
          .schema('pipeline')
          .from('listings')
          .select('id, title, description')
          .is('sanitised_at', null) // Only process unsanitized listings
          .eq('status', 'active'); // Only process active listings (exclude expired, sold, removed)

        // Apply filters if provided
        if (listingIds && listingIds.length > 0) {
          query = query.in('id', listingIds);
        }

        if (limit) {
          query = query.limit(limit);
        }

        const { data, error } = await query;

        if (error) {
          throw new Error(`Failed to query listings: ${error.message}`);
        }

        return (data || []) as Listing[];
      });

      if (listings.length === 0) {
        // Complete job with no work
        await step.run('complete-job-no-work', async () => {
          const jobService = new BaseJobService(supabaseServer);
          await jobService.completeJob(
            jobId!,
            { listings_found: 0, listings_new: 0, listings_updated: 0 },
            'No listings found to sanitize'
          );
        });
        return {
          jobId,
          status: 'completed',
          listings_found: 0,
          listings_updated: 0,
        };
      }

      const listingsFound = listings.length;

      // Step 4: Update progress - found listings
      await step.run('update-progress-found', async () => {
        const jobService = new BaseJobService(supabaseServer);
        await jobService.updateJobProgress(
          jobId!,
          `Found ${listingsFound} listings to sanitize...`,
          { listings_found: listingsFound }
        );
      });

      // Step 5: Process listings in batches
      let listingsUpdated = 0;
      const batches = Math.ceil(listings.length / BATCH_SIZE);

      for (let i = 0; i < batches; i++) {
        const start = i * BATCH_SIZE;
        const end = Math.min(start + BATCH_SIZE, listings.length);
        const batch = listings.slice(start, end);

        const updated = await step.run(`sanitize-batch-${i}`, async () => {
          const sanitizationService = new SanitizationService();
          const sanitisedAt = new Date().toISOString();
          let batchUpdated = 0;

          for (const listing of batch) {
            try {
              // Sanitize the listing
              const { sanitised_title, sanitised_description } =
                sanitizationService.sanitizeListing(listing);

              // Update listing with sanitised fields
              const { error: updateError } = await supabaseServer
                .schema('pipeline')
                .from('listings')
                .update({
                  sanitised_title,
                  sanitised_description,
                  sanitised_at: sanitisedAt,
                  updated_at: sanitisedAt,
                })
                .eq('id', listing.id);

              if (updateError) {
                console.error(
                  `Error updating listing ${listing.id}:`,
                  updateError
                );
                continue;
              }

              batchUpdated++;
            } catch (error) {
              console.error(
                `Error sanitizing listing ${listing.id}:`,
                error
              );
              // Continue processing other listings
            }
          }

          return batchUpdated;
        });

        listingsUpdated += updated;

        // Update progress after each batch
        await step.run(`update-progress-batch-${i}`, async () => {
          const jobService = new BaseJobService(supabaseServer);
          await jobService.updateJobProgress(
            jobId!,
            `Processed ${listingsUpdated} of ${listingsFound} listings...`,
            { listings_found: listingsFound }
          );
        });
      }

      // Step 6: Complete job
      await step.run('complete-job', async () => {
        const jobService = new BaseJobService(supabaseServer);
        await jobService.completeJob(
          jobId!,
          {
            listings_found: listingsFound,
            listings_new: 0,
            listings_updated: listingsUpdated,
          },
          `Completed: Sanitized ${listingsUpdated} listings`
        );
      });

      return {
        jobId,
        status: 'completed',
        listings_found: listingsFound,
        listings_updated: listingsUpdated,
      };
    } catch (error) {
      // Mark job as failed if it was created
      if (jobId) {
        await step.run('fail-job', async () => {
          const jobService = new BaseJobService(supabaseServer);
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          await jobService.failJob(jobId!, errorMessage);
        });
      }

      // Re-throw to let Inngest know function failed
      throw error;
    }
  }
);
