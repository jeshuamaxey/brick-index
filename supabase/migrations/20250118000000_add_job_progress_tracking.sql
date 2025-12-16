-- Add job progress tracking fields and analyze_listings job type

-- Add updated_at and last_update columns to jobs table
ALTER TABLE pipeline.jobs 
  ADD COLUMN updated_at TIMESTAMP DEFAULT NOW(),
  ADD COLUMN last_update TEXT;

-- Add trigger for updated_at (using existing function)
CREATE TRIGGER update_jobs_updated_at 
  BEFORE UPDATE ON pipeline.jobs
  FOR EACH ROW EXECUTE FUNCTION pipeline.update_updated_at_column();

-- Add index on updated_at for efficient querying
CREATE INDEX IF NOT EXISTS idx_jobs_updated_at ON pipeline.jobs(updated_at DESC);

-- Add analyze_listings job type to enum
ALTER TYPE pipeline.job_type ADD VALUE IF NOT EXISTS 'analyze_listings';

-- Set updated_at for existing rows to started_at (or now if started_at is null)
UPDATE pipeline.jobs 
SET updated_at = COALESCE(started_at, NOW())
WHERE updated_at IS NULL;
