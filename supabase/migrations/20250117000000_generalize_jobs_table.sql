-- Generalize capture_jobs table to jobs table with type enum

-- Create job_type enum
CREATE TYPE pipeline.job_type AS ENUM (
  'ebay_refresh_listings',
  'ebay_enrich_listings'
  -- Future job types can be added here, e.g.:
  -- 'facebook_refresh_listings',
  -- 'analyze_listing',
  -- 'discover_match'
);

-- Rename table from capture_jobs to jobs
ALTER TABLE pipeline.capture_jobs RENAME TO jobs;

-- Add type column (NOT NULL, but we'll set default for existing rows first)
ALTER TABLE pipeline.jobs ADD COLUMN type pipeline.job_type;

-- Set default type for existing rows (assuming all are eBay capture jobs)
UPDATE pipeline.jobs SET type = 'ebay_refresh_listings' WHERE type IS NULL;

-- Make type column NOT NULL now that all rows have values
ALTER TABLE pipeline.jobs ALTER COLUMN type SET NOT NULL;

-- Add metadata column for flexible job-specific data storage
ALTER TABLE pipeline.jobs ADD COLUMN metadata JSONB DEFAULT '{}'::jsonb;

-- Add index on type for efficient filtering
CREATE INDEX IF NOT EXISTS idx_jobs_type ON pipeline.jobs(type);

-- Add index on started_at for efficient sorting (most recent first)
CREATE INDEX IF NOT EXISTS idx_jobs_started_at ON pipeline.jobs(started_at DESC);

-- Add comment explaining the jobs table
COMMENT ON TABLE pipeline.jobs IS 'Generalized table for tracking async operations across the pipeline';
COMMENT ON COLUMN pipeline.jobs.type IS 'Type of job being performed (marketplace_action format)';
COMMENT ON COLUMN pipeline.jobs.metadata IS 'Flexible JSONB field for job-specific data storage';

