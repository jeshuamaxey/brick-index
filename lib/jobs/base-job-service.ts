// Base job service utilities for creating and updating jobs

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Json } from '@/lib/supabase/supabase.types';
import { createServiceLogger, type AppLogger } from '@/lib/logging';
import type { Job, JobType } from '@/lib/types';

export interface JobStats {
  listings_found?: number;
  listings_new?: number;
  listings_updated?: number;
  [key: string]: unknown;
}

// Timeout configuration in milliseconds
const JOB_TIMEOUTS: Record<string, number> = {
  'ebay_refresh_listings': 30 * 60 * 1000, // 30 minutes
  'ebay_materialize_listings': 30 * 60 * 1000, // 30 minutes
  'ebay_enrich_listings': 60 * 60 * 1000,  // 60 minutes
  'analyze_listings': 15 * 60 * 1000,      // 15 minutes
  'reconcile': 15 * 60 * 1000,              // 15 minutes
  'sanitize_listings': 30 * 60 * 1000,      // 30 minutes
  'lego_catalog_refresh': 60 * 60 * 1000,  // 60 minutes (for large CSV processing)
};

// Default timeout if job type not found (30 minutes)
const DEFAULT_TIMEOUT = 30 * 60 * 1000;

export class BaseJobService {
  private log: AppLogger;

  constructor(private supabase: SupabaseClient<Database>, parentLogger?: AppLogger) {
    this.log = parentLogger 
      ? parentLogger.child({ service: 'BaseJobService' })
      : createServiceLogger('BaseJobService');
  }

  /**
   * Get timeout duration for a job type in milliseconds
   */
  private getJobTimeout(type: JobType): number {
    return JOB_TIMEOUTS[type] || DEFAULT_TIMEOUT;
  }

  /**
   * Create a new job resource with timeout tracking
   */
  async createJob(
    type: JobType,
    marketplace: string,
    metadata: Record<string, unknown> = {},
    datasetId?: string | null
  ): Promise<Job> {
    const now = new Date();
    const nowISO = now.toISOString();
    
    // Calculate timeout_at based on job type
    const timeoutMs = this.getJobTimeout(type);
    const timeoutAt = new Date(now.getTime() + timeoutMs);
    
    // Extract dataset_id from metadata if not provided directly (for backward compatibility)
    const resolvedDatasetId = datasetId || (metadata.dataset_id as string | undefined) || null;
    
    // Remove dataset_id from metadata if it exists (we store it in the column now)
    const cleanMetadata = { ...metadata };
    if ('dataset_id' in cleanMetadata) {
      delete cleanMetadata.dataset_id;
    }
    
    // Build insert object - include dataset_id in the column, not in metadata
    const insertData: any = {
      type,
      marketplace,
      status: 'running',
      listings_found: 0,
      listings_new: 0,
      listings_updated: 0,
      started_at: nowISO,
      updated_at: nowISO,
      timeout_at: timeoutAt.toISOString(),
      last_update: 'Job started',
      metadata: cleanMetadata as Json,
      dataset_id: resolvedDatasetId,
    };
    
    // Use type assertion to bypass TypeScript checking for dataset_id field
    // The column exists in the database (via migration), but types may not be regenerated
    const { data: job, error } = await (this.supabase
      .schema('pipeline')
      .from('jobs') as any)
      .insert(insertData)
      .select()
      .single();

    if (error) {
      throw new Error(
        `Failed to create job: ${error.message || error.details || JSON.stringify(error)}`
      );
    }

    if (!job) {
      throw new Error('Failed to create job: No data returned');
    }

    return job;
  }

  /**
   * Update job progress with a message and optional stats
   */
  async updateJobProgress(
    jobId: string,
    message: string,
    stats?: Partial<JobStats>
  ): Promise<void> {
    const updateData: {
      last_update: string;
      updated_at: string;
      listings_found?: number;
      listings_new?: number;
      listings_updated?: number;
    } = {
      last_update: message,
      updated_at: new Date().toISOString(),
    };

    if (stats) {
      if (stats.listings_found !== undefined) {
        updateData.listings_found = stats.listings_found;
      }
      if (stats.listings_new !== undefined) {
        updateData.listings_new = stats.listings_new;
      }
      if (stats.listings_updated !== undefined) {
        updateData.listings_updated = stats.listings_updated;
      }
    }

    const { error } = await this.supabase
      .schema('pipeline')
      .from('jobs')
      .update(updateData)
      .eq('id', jobId);

    if (error) {
      this.log.warn({ err: error, jobId }, 'Error updating job progress (non-critical)');
      // Don't throw - progress updates are best effort
    }
  }

  /**
   * Mark a job as completed
   */
  async completeJob(
    jobId: string,
    stats?: Partial<JobStats>,
    finalMessage?: string
  ): Promise<void> {
    const updateData: {
      status: string;
      completed_at: string;
      updated_at: string;
      last_update?: string;
      listings_found?: number;
      listings_new?: number;
      listings_updated?: number;
    } = {
      status: 'completed',
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    if (finalMessage) {
      updateData.last_update = finalMessage;
    }

    if (stats) {
      if (stats.listings_found !== undefined) {
        updateData.listings_found = stats.listings_found;
      }
      if (stats.listings_new !== undefined) {
        updateData.listings_new = stats.listings_new;
      }
      if (stats.listings_updated !== undefined) {
        updateData.listings_updated = stats.listings_updated;
      }
    }

    const { error } = await this.supabase
      .schema('pipeline')
      .from('jobs')
      .update(updateData)
      .eq('id', jobId);

    if (error) {
      throw new Error(`Failed to complete job: ${error.message}`);
    }
  }

  /**
   * Mark a job as failed
   */
  async failJob(jobId: string, errorMessage: string): Promise<void> {
    const { error } = await this.supabase
      .schema('pipeline')
      .from('jobs')
      .update({
        status: 'failed',
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        last_update: `Job failed: ${errorMessage}`,
        error_message: errorMessage,
      })
      .eq('id', jobId);

    if (error) {
      throw new Error(`Failed to mark job as failed: ${error.message}`);
    }
  }
}
