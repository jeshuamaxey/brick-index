-- Add timeout tracking and stale job detection for jobs table

-- Add timeout_at column to jobs table
ALTER TABLE pipeline.jobs 
  ADD COLUMN timeout_at TIMESTAMP;

-- Add index on timeout_at for efficient stale job queries
CREATE INDEX IF NOT EXISTS idx_jobs_timeout_at ON pipeline.jobs(timeout_at) 
  WHERE status = 'running';

-- Add index on updated_at for progress-based stale detection
CREATE INDEX IF NOT EXISTS idx_jobs_running_updated_at ON pipeline.jobs(updated_at) 
  WHERE status = 'running';

-- Function to detect and mark stale jobs as timed out
CREATE OR REPLACE FUNCTION pipeline.mark_stale_jobs_as_timed_out()
RETURNS TABLE(
  jobs_updated INTEGER,
  job_ids UUID[]
) AS $$
DECLARE
  updated_count INTEGER;
  updated_ids UUID[];
BEGIN
  -- Mark jobs as timed out if:
  -- 1. No progress update in 10 minutes (updated_at check), OR
  -- 2. Exceeded timeout_at (if set), OR
  -- 3. Running longer than absolute maximum (60 minutes for safety)
  WITH stale_jobs AS (
    UPDATE pipeline.jobs 
    SET 
      status = 'failed',
      completed_at = NOW(),
      updated_at = NOW(),
      last_update = 'Job timed out: No progress detected or exceeded maximum runtime',
      error_message = 'Job timed out after ' || 
        ROUND(EXTRACT(EPOCH FROM (NOW() - started_at)) / 60, 1) || ' minutes'
    WHERE 
      status = 'running' 
      AND (
        -- No progress in 10 minutes
        updated_at < NOW() - INTERVAL '10 minutes'
        OR
        -- Exceeded explicit timeout
        (timeout_at IS NOT NULL AND timeout_at < NOW())
        OR
        -- Absolute maximum: 60 minutes
        started_at < NOW() - INTERVAL '60 minutes'
      )
    RETURNING id
  )
  SELECT 
    COUNT(*)::INTEGER,
    ARRAY_AGG(id)
  INTO updated_count, updated_ids
  FROM stale_jobs;

  RETURN QUERY SELECT updated_count, COALESCE(updated_ids, ARRAY[]::UUID[]);
END;
$$ LANGUAGE plpgsql;

-- Grant execute permission on the function
GRANT EXECUTE ON FUNCTION pipeline.mark_stale_jobs_as_timed_out() TO anon, authenticated, service_role;

-- Add comment explaining the function
COMMENT ON FUNCTION pipeline.mark_stale_jobs_as_timed_out() IS 
  'Detects and marks stale jobs as timed out. Checks for: no progress in 10 minutes, exceeded timeout_at, or running longer than 60 minutes.';
