// Inngest function for capture jobs
// Handles long-running capture jobs by breaking work into steps

import { inngest } from '@/lib/inngest/client';
import { supabaseServer } from '@/lib/supabase/server';
import { BaseJobService } from '@/lib/jobs/base-job-service';
import { EbayAdapter, type EbaySearchParams } from '@/lib/capture/marketplace-adapters/ebay-adapter';
import { getEbayAccessToken } from '@/lib/ebay/oauth-token-service';
import { createJobLogger } from '@/lib/logging';
import type { JobType } from '@/lib/types';
import type { Json } from '@/lib/supabase/supabase.types';

import { INNGEST_FUNCTION_IDS } from './registry';

// Logging helper for consistent prefixing
const log = {
  info: (message: string, data?: Record<string, unknown>) => {
    console.log(`[CaptureJob] ${message}`, data ? JSON.stringify(data) : '');
  },
  error: (message: string, error?: unknown, data?: Record<string, unknown>) => {
    console.error(`[CaptureJob] ERROR: ${message}`, {
      error: error instanceof Error ? { message: error.message, stack: error.stack } : error,
      ...data,
    });
  },
  debug: (message: string, data?: Record<string, unknown>) => {
    if (process.env.DEBUG_CAPTURE_JOB === 'true') {
      console.log(`[CaptureJob] DEBUG: ${message}`, data ? JSON.stringify(data) : '');
    }
  },
};

export const captureJob = inngest.createFunction(
  { id: INNGEST_FUNCTION_IDS.CAPTURE_JOB },
  { event: 'job/capture.triggered' },
  async ({ event, step }) => {
    // Note: Logger creation outside steps, but logging inside steps to avoid duplicates during replay
    let log = createJobLogger('pending', 'capture');
    let jobId: string | null = null;
    const startTime = Date.now();

    try {
      const { marketplace, keywords, ebayParams, datasetId, datasetName, userId } = event.data;
      
      log.info('Capture job started', {
        marketplace,
        keywords,
        datasetId,
        datasetName,
        userId,
        ebayParams: ebayParams ? Object.keys(ebayParams as object) : null,
      });

      // Step 1: Create job record
      const job = await step.run('create-job', async () => {
        log.info({ eventData: event.data }, 'Capture job triggered');
        const jobService = new BaseJobService(supabaseServer);
        const jobType: JobType = `${marketplace}_refresh_listings` as JobType;
        const metadata: Record<string, unknown> = {
          keywords,
          adapterParams: ebayParams || null,
        };
        
        // Add dataset information to metadata if provided
        if (datasetName) {
          metadata.dataset_name = datasetName;
        }
        if (userId) {
          metadata.user_id = userId;
        }
        
        const createdJob = await jobService.createJob(jobType, marketplace, metadata, datasetId || null);
        log.info('Job record created', { jobId: createdJob.id, jobType, marketplace });
        return createdJob;
      });

      jobId = job.id;
      log = log.child({ jobId, marketplace });

      // Step 2: Update progress - searching
      await step.run('update-progress-searching', async () => {
        const jobService = new BaseJobService(supabaseServer);
        await jobService.updateJobProgress(jobId!, 'Searching marketplace...');
      });

      // Step 3: Prepare search parameters and adapter config
      const searchConfig = await step.run('prepare-search-config', async () => {
        if (marketplace !== 'ebay') {
          throw new Error(`Unsupported marketplace: ${marketplace}`);
        }

        const ebayAppId = process.env.EBAY_APP_ID;
        const dataMode = process.env.EBAY_DATA_MODE ?? 'live';

        if (dataMode === 'cache') {
          // For cache mode, we still need to use the snapshot adapter
          // But we'll handle this differently - snapshot adapter doesn't support fetchPage
          throw new Error('Cache mode (EBAY_DATA_MODE=cache) not supported with page-level steps. Use live mode.');
        }

        if (!ebayAppId) {
          throw new Error(
            'EBAY_APP_ID is required when EBAY_DATA_MODE=live. Either set EBAY_DATA_MODE=cache or provide EBAY_APP_ID.'
          );
        }

        // Parse ebayParams for search configuration
        const params = ebayParams as EbaySearchParams | undefined;
        
        // Validate keywords (required)
        if (!keywords || !Array.isArray(keywords) || keywords.length === 0) {
          throw new Error('keywords is required and must be a non-empty array');
        }
        
        const keywordQuery = keywords.join(' ');
        const limit = params?.entriesPerPage || 200;
        const maxResults = params?.maxResults || 10000;
        const fieldgroups = params?.fieldgroups || 'EXTENDED';
        const marketplaceId = params?.marketplaceId || process.env.EBAY_MARKETPLACE_ID || 'EBAY_US';

        log.info('Search config prepared', {
          jobId,
          keywordQuery,
          limit,
          maxResults,
          fieldgroups,
          marketplaceId,
        });

        return {
          ebayAppId,
          keywordQuery,
          limit,
          maxResults,
          fieldgroups,
          marketplaceId,
          params: ebayParams || undefined,
        };
      });

      // Step 4: Search marketplace with page-level steps
      let totalItems = 0;
      let pageNumber = 0;
      let offset = 0;
      let hasMore = true;
      const rawListingIds: string[] = [];
      let totalAvailable: number | null = null;

      while (hasMore) {
        const pageResult = await step.run(`search-page-${pageNumber}`, async () => {
          // Create adapter (can't serialize between steps)
          const adapter = new EbayAdapter(searchConfig.ebayAppId);
          
          // Get OAuth token
          const token = await getEbayAccessToken();
          
          // Fetch one page
          const response = await adapter.fetchPage(
            searchConfig.keywordQuery,
            searchConfig.limit,
            offset,
            searchConfig.fieldgroups,
            searchConfig.params,
            token,
            searchConfig.marketplaceId
          );

          const items = response.itemSummaries || [];
          
          // Log eBay API response
          log.info('eBay API response received', {
            jobId,
            pageNumber,
            offset,
            requestedLimit: searchConfig.limit,
            itemsReturned: items.length,
            totalAvailable: response.total ?? null,
            hasNextPage: !!response.next,
            warningCount: response.warnings?.length ?? 0,
          });
          
          // Log warnings separately if present
          if (response.warnings && response.warnings.length > 0) {
            log.info('eBay API returned warnings', {
              jobId,
              pageNumber,
              warnings: response.warnings,
            });
          }
          
          // Store immediately to database
          const ids: string[] = [];
          for (const item of items) {
            const { data: rawListing, error: rawError } = await supabaseServer
              .schema('pipeline')
              .from('raw_listings')
              .insert({
                marketplace,
                api_response: item as Json,
                job_id: jobId!,
              })
              .select('id')
              .single();

            if (rawError) {
              log.error('Failed to store raw listing', rawError, { jobId, pageNumber });
              continue;
            }

            if (rawListing) {
              ids.push(rawListing.id);
            }
          }

          // Update total from first response
          if (totalAvailable === null) {
            totalAvailable = response.total ?? null;
          }

          // Check if we should continue pagination
          const currentTotal = totalItems + ids.length;
          const shouldContinue = 
            response.next && 
            currentTotal < searchConfig.maxResults &&
            (totalAvailable === null || offset + searchConfig.limit < totalAvailable);

          log.debug('Page fetched', {
            jobId,
            pageNumber,
            itemsStored: ids.length,
            totalAvailable,
            shouldContinue,
            offset,
          });

          return {
            pageNumber,
            itemsStored: ids.length,
            totalItems: totalAvailable,
            hasMore: shouldContinue,
            rawListingIds: ids,
          };
        });

        // Accumulate results
        totalItems += pageResult.itemsStored;
        rawListingIds.push(...pageResult.rawListingIds);
        hasMore = Boolean(pageResult.hasMore);
        offset += searchConfig.limit;
        pageNumber++;

        // Update progress periodically (every 10 pages)
        if (pageNumber % 10 === 0) {
          await step.run(`update-progress-pages-${pageNumber}`, async () => {
            const jobService = new BaseJobService(supabaseServer);
            await jobService.updateJobProgress(
              jobId!,
              `Fetched ${pageNumber} pages, ${totalItems} listings stored...`,
              { listings_found: totalItems }
            );
          });
        }

        // If cancelled, Inngest stops here before next step.run()
      }

      const listingsFound = totalItems;
      
      log.info('Search pagination complete', {
        jobId,
        totalPages: pageNumber,
        listingsFound,
        rawListingIdsCount: rawListingIds.length,
      });

      // Step 5: Associate raw_listings with dataset if datasetId is provided
      if (datasetId && rawListingIds.length > 0) {
        log.info('Associating raw listings with dataset', {
          jobId,
          datasetId,
          rawListingCount: rawListingIds.length,
        });
        
        await step.run('associate-raw-listings-with-dataset', async () => {
          const { DatasetService } = await import('@/lib/datasets/dataset-service');
          // Use service role client - dataset was already validated to belong to user when capture was triggered
          const datasetService = new DatasetService(supabaseServer);
          
          try {
            await datasetService.addRawListingsToDataset(datasetId, rawListingIds);
            log.info('Dataset association complete', { jobId, datasetId });
          } catch (error) {
            // Log but don't fail the job if dataset association fails
            log.warn({ err: error, datasetId }, 'Error associating raw_listings with dataset (continuing)');
          }
        });
      }

      // Step 6: Complete capture job
      await step.run('complete-capture-job', async () => {
        const jobService = new BaseJobService(supabaseServer);
        await jobService.completeJob(
          jobId!,
          {
            listings_found: listingsFound,
          },
          `Completed: Captured ${listingsFound} raw listings`
        );
      });

      const durationMs = Date.now() - startTime;
      log.info('Capture job completed successfully', {
        jobId,
        listingsFound,
        rawListingsStored: listingsFound,
        durationMs,
        durationFormatted: `${Math.round(durationMs / 1000)}s`,
      });

      return {
        jobId,
        status: 'completed',
        listings_found: listingsFound,
        raw_listings_stored: listingsFound,
      };
    } catch (error) {
      const durationMs = Date.now() - startTime;
      log.error('Capture job failed', error, {
        jobId,
        durationMs,
        durationFormatted: `${Math.round(durationMs / 1000)}s`,
      });
      
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

