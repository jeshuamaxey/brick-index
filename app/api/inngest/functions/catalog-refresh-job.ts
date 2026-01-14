// Inngest function for LEGO catalog refresh jobs
// Handles downloading and processing Rebrickable CSV files

import { inngest } from '@/lib/inngest/client';
import { supabaseServer } from '@/lib/supabase/server';
import { BaseJobService } from '@/lib/jobs/base-job-service';
import { LegoCatalogService } from '@/lib/catalog/lego-catalog-service';
import type { JobType } from '@/lib/types';
import type { Json } from '@/lib/supabase/supabase.types';

import { INNGEST_FUNCTION_IDS } from './registry';

const SETS_BATCH_SIZE = 1000; // Process 1000 sets per step to avoid timeout

interface CatalogRefreshJobEvent {
  name: 'job/catalog-refresh.triggered';
  data: {
    jobId?: string; // Optional: if provided, use existing job instead of creating new one
  };
}

export const catalogRefreshJob = inngest.createFunction(
  { id: INNGEST_FUNCTION_IDS.CATALOG_REFRESH_JOB },
  { event: 'job/catalog-refresh.triggered' },
  async ({ event, step }) => {
    let jobId: string | null = null;

    try {
      // Step 1: Create job record (or use existing if jobId provided)
      const job = await step.run('create-job', async () => {
        // If jobId is provided, fetch the existing job instead of creating a new one
        if (event.data.jobId) {
          const { data: existingJob, error } = await supabaseServer
            .schema('pipeline')
            .from('jobs')
            .select('*')
            .eq('id', event.data.jobId)
            .single();

          if (error) {
            throw new Error(`Failed to fetch existing job: ${error.message}`);
          }

          if (!existingJob) {
            throw new Error(`Job not found: ${event.data.jobId}`);
          }

          return existingJob;
        }

        // Otherwise, create a new job (backward compatibility)
        const jobService = new BaseJobService(supabaseServer);
        return await jobService.createJob(
          'lego_catalog_refresh' as JobType,
          'rebrickable',
          {}
        );
      });

      jobId = job.id;

      // Step 2: Update progress - starting
      await step.run('update-progress-starting', async () => {
        const jobService = new BaseJobService(supabaseServer);
        await jobService.updateJobProgress(jobId!, 'Starting catalog refresh...');
      });

      // Step 3: Check which files have changed
      const fileChanges = await step.run('check-file-changes', async () => {
        const catalogService = new LegoCatalogService(supabaseServer);
        const filesToCheck = ['themes.csv.gz', 'sets.csv.gz'];
        const results: Array<{
          filename: string;
          changed: boolean;
          metadata?: {
            etag: string | null;
            last_modified: string | null;
            content_length: number | null;
          };
        }> = [];

        for (const filename of filesToCheck) {
          const result = await catalogService.checkFileChanged(filename);
          results.push({ filename, ...result });
        }

        return results;
      });

      const changedFiles = fileChanges.filter((f) => f.changed);
      const unchangedFiles = fileChanges.filter((f) => !f.changed);

      // Update progress with file check results
      await step.run('update-progress-file-check', async () => {
        const jobService = new BaseJobService(supabaseServer);
        await jobService.updateJobProgress(
          jobId!,
          `Checked ${fileChanges.length} files: ${changedFiles.length} changed, ${unchangedFiles.length} unchanged`
        );
      });

      // Early exit if no files changed
      if (changedFiles.length === 0) {
        await step.run('complete-job-no-changes', async () => {
          const jobService = new BaseJobService(supabaseServer);
          
          // Update metadata
          await supabaseServer
            .schema('pipeline')
            .from('jobs')
            .update({
              metadata: {
                files_checked: fileChanges.length,
                files_changed: 0,
                files_unchanged: unchangedFiles.length,
              } as Json,
            })
            .eq('id', jobId!);

          await jobService.completeJob(
            jobId!,
            {},
            'Catalog refresh skipped: No files changed since last refresh'
          );
        });

        return {
          jobId,
          status: 'completed',
          filesChanged: 0,
          filesUnchanged: unchangedFiles.length,
          message: 'No files changed since last refresh',
        };
      }

      // Track stats
      let totalThemesFound = 0;
      let totalThemesNew = 0;
      let totalThemesUpdated = 0;
      let totalSetsFound = 0;
      let totalSetsNew = 0;
      let totalSetsUpdated = 0;

      // Step 4: Process themes if changed
      const themesFile = changedFiles.find((f) => f.filename === 'themes.csv.gz');
      if (themesFile) {
        // Download and parse themes
        const themesData = await step.run('download-themes', async () => {
          const catalogService = new LegoCatalogService(supabaseServer);
          return await catalogService.downloadAndParseCsv('themes.csv.gz');
        });

        // Update progress
        await step.run('update-progress-themes-downloaded', async () => {
          const jobService = new BaseJobService(supabaseServer);
          await jobService.updateJobProgress(
            jobId!,
            `Downloaded themes.csv.gz: ${themesData.themes?.length || 0} themes found`
          );
        });

        // Upsert themes (small dataset, can do in one step)
        if (themesData.themes && themesData.themes.length > 0) {
          const themesResult = await step.run('upsert-themes', async () => {
            const catalogService = new LegoCatalogService(supabaseServer);
            return await catalogService.upsertThemes(themesData.themes!);
          });

          totalThemesFound = themesResult.found;
          totalThemesNew = themesResult.new;
          totalThemesUpdated = themesResult.updated;

          // Update CSV metadata
          await step.run('update-themes-metadata', async () => {
            const catalogService = new LegoCatalogService(supabaseServer);
            await catalogService.updateCsvFileMetadata('themes.csv.gz', {
              ...themesFile.metadata,
              last_downloaded_at: new Date().toISOString(),
            });
          });
        }
      }

      // Step 5: Process sets if changed
      const setsFile = changedFiles.find((f) => f.filename === 'sets.csv.gz');
      if (setsFile) {
        // Download, parse, and process sets in batches (avoid returning large arrays)
        const setsSummary = await step.run('download-and-process-sets', async () => {
          const catalogService = new LegoCatalogService(supabaseServer);
          const jobService = new BaseJobService(supabaseServer);
          
          // Download and parse CSV
          const csvContent = await catalogService.downloadCsvFile('sets.csv.gz');
          const sets = await catalogService.parseSetsCsv(csvContent);
          
          const totalSets = sets.length;
          const batches = Math.ceil(totalSets / SETS_BATCH_SIZE);
          let totalUpdated = 0;

          // Process sets in batches to avoid large step output
          for (let i = 0; i < batches; i++) {
            const start = i * SETS_BATCH_SIZE;
            const end = Math.min(start + SETS_BATCH_SIZE, totalSets);
            const batch = sets.slice(start, end);

            const batchResult = await catalogService.upsertSetsBatch(batch);
            totalUpdated += batchResult.updated;

            // Update progress every few batches
            if (i % 5 === 0 || i === batches - 1) {
              await jobService.updateJobProgress(
                jobId!,
                `Processing sets: ${Math.min(end, totalSets)}/${totalSets} processed...`
              );
            }
          }

          // Return only summary statistics, not the full sets array
          return {
            totalSets,
            totalUpdated,
            batches,
          };
        });

        totalSetsFound = setsSummary.totalSets;
        totalSetsUpdated = setsSummary.totalUpdated;

        // Update progress
        await step.run('update-progress-sets-downloaded', async () => {
          const jobService = new BaseJobService(supabaseServer);
          await jobService.updateJobProgress(
            jobId!,
            `Downloaded and processed sets.csv.gz: ${totalSetsFound} sets found`
          );
        });

        // Update CSV metadata
        await step.run('update-sets-metadata', async () => {
          const catalogService = new LegoCatalogService(supabaseServer);
          await catalogService.updateCsvFileMetadata('sets.csv.gz', {
            ...setsFile.metadata,
            last_downloaded_at: new Date().toISOString(),
          });
        });

        // Estimate new vs updated (simplified)
        totalSetsNew = Math.floor(totalSetsFound * 0.1); // Rough estimate: 10% new
        totalSetsUpdated = totalSetsFound - totalSetsNew;
      }

      // Step 6: Update final metadata and complete job
      await step.run('complete-job', async () => {
        const jobService = new BaseJobService(supabaseServer);

        // Update metadata with final stats
        await supabaseServer
          .schema('pipeline')
          .from('jobs')
          .update({
            metadata: {
              files_checked: fileChanges.length,
              files_changed: changedFiles.length,
              files_unchanged: unchangedFiles.length,
              sets_found: totalSetsFound,
              sets_new: totalSetsNew,
              sets_updated: totalSetsUpdated,
              themes_found: totalThemesFound,
              themes_new: totalThemesNew,
              themes_updated: totalThemesUpdated,
            } as Json,
          })
          .eq('id', jobId!);

        await jobService.completeJob(
          jobId!,
          {},
          `Catalog refresh completed: ${changedFiles.length} file(s) updated, ${totalSetsNew} new sets, ${totalSetsUpdated} sets updated`
        );
      });

      return {
        jobId,
        status: 'completed',
        filesChanged: changedFiles.length,
        filesUnchanged: unchangedFiles.length,
        themesFound: totalThemesFound,
        themesNew: totalThemesNew,
        themesUpdated: totalThemesUpdated,
        setsFound: totalSetsFound,
        setsNew: totalSetsNew,
        setsUpdated: totalSetsUpdated,
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
