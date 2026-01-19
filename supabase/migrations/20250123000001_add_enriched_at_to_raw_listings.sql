-- Add enriched_at column to raw_listings to track enrichment status
-- This allows the enrich job to query for unenriched raw listings

ALTER TABLE pipeline.raw_listings
  ADD COLUMN IF NOT EXISTS enriched_at TIMESTAMP;

-- Add index for efficient querying of unenriched raw listings
CREATE INDEX IF NOT EXISTS idx_raw_listings_enriched_at ON pipeline.raw_listings(enriched_at);

-- Add comment
COMMENT ON COLUMN pipeline.raw_listings.enriched_at IS 'Timestamp when this raw listing was enriched with getItem API data. NULL means not yet enriched.';
