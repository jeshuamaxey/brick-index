-- Add job_id column to raw_listings table to track which capture job created each raw listing

-- Add job_id column with foreign key reference to jobs table
ALTER TABLE pipeline.raw_listings
  ADD COLUMN IF NOT EXISTS job_id UUID REFERENCES pipeline.jobs(id);

-- Add index on job_id for efficient filtering
CREATE INDEX IF NOT EXISTS idx_raw_listings_job_id ON pipeline.raw_listings(job_id);

-- Add comment explaining the column
COMMENT ON COLUMN pipeline.raw_listings.job_id IS 'Reference to the capture job that created this raw listing. Used to identify which raw listings need to be materialized.';

-- Add materialize_listings job type to enum
ALTER TYPE pipeline.job_type ADD VALUE IF NOT EXISTS 'ebay_materialize_listings';
