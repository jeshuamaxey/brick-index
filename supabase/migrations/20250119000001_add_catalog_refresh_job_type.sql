-- Add lego_catalog_refresh job type to pipeline.job_type enum

-- Add new job type to the enum
ALTER TYPE pipeline.job_type ADD VALUE IF NOT EXISTS 'lego_catalog_refresh';

-- Add comment explaining the new job type
COMMENT ON TYPE pipeline.job_type IS 'Job types: ebay_refresh_listings, ebay_enrich_listings, analyze_listings, lego_catalog_refresh';
