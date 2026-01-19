-- Add sanitize_listings job type to pipeline.job_type enum

-- Add new job type to the enum
ALTER TYPE pipeline.job_type ADD VALUE IF NOT EXISTS 'sanitize_listings';

-- Update comment explaining the job types
COMMENT ON TYPE pipeline.job_type IS 'Job types: ebay_refresh_listings, ebay_materialize_listings, ebay_enrich_listings, analyze_listings, lego_catalog_refresh, reconcile, sanitize_listings';
