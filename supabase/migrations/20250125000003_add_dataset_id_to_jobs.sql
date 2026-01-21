-- Add dataset_id column to jobs table for easier querying and relationship tracking

-- Add dataset_id column (optional, nullable)
ALTER TABLE pipeline.jobs 
  ADD COLUMN dataset_id UUID REFERENCES public.datasets(id) ON DELETE SET NULL;

-- Add index on dataset_id for efficient filtering
CREATE INDEX IF NOT EXISTS idx_jobs_dataset_id ON pipeline.jobs(dataset_id);

-- Add comment
COMMENT ON COLUMN pipeline.jobs.dataset_id IS 'Optional reference to the dataset this job is associated with. Jobs can be triggered with just a dataset_id or with more specific configuration.';

-- Backfill dataset_id from metadata for existing jobs
-- This migrates dataset_id from metadata JSONB to the dedicated column
UPDATE pipeline.jobs
SET dataset_id = (metadata->>'dataset_id')::uuid
WHERE metadata->>'dataset_id' IS NOT NULL
  AND dataset_id IS NULL;
