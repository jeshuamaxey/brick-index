-- Add job_id column to listings table to track which job created each listing

-- Add job_id column with foreign key reference to jobs table
ALTER TABLE pipeline.listings
  ADD COLUMN IF NOT EXISTS job_id UUID REFERENCES pipeline.jobs(id);

-- Add index on job_id for efficient filtering
CREATE INDEX IF NOT EXISTS idx_listings_job_id ON pipeline.listings(job_id);

-- Add comment explaining the column
COMMENT ON COLUMN pipeline.listings.job_id IS 'Reference to the job that created this listing. NULL for listings created before job tracking was implemented.';
