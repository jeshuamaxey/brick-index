-- Add enrichment tracking and extracted fields to listings table

-- Add enrichment tracking columns
ALTER TABLE pipeline.listings
  ADD COLUMN IF NOT EXISTS enriched_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS enriched_raw_listing_id UUID REFERENCES pipeline.raw_listings(id);

-- Add extracted fields from getItem API
ALTER TABLE pipeline.listings
  ADD COLUMN IF NOT EXISTS additional_images TEXT[],
  ADD COLUMN IF NOT EXISTS condition_description TEXT,
  ADD COLUMN IF NOT EXISTS category_path TEXT,
  ADD COLUMN IF NOT EXISTS item_location JSONB,
  ADD COLUMN IF NOT EXISTS estimated_availabilities JSONB,
  ADD COLUMN IF NOT EXISTS buying_options TEXT[];

-- Add index on enriched_at for efficient querying of unenriched listings
CREATE INDEX IF NOT EXISTS idx_listings_enriched_at ON pipeline.listings(enriched_at);

-- Add comment explaining the enrichment fields
COMMENT ON COLUMN pipeline.listings.enriched_at IS 'Timestamp when listing was enriched with getItem API data';
COMMENT ON COLUMN pipeline.listings.enriched_raw_listing_id IS 'Reference to raw_listings record containing the getItem API response';
COMMENT ON COLUMN pipeline.listings.additional_images IS 'Additional image URLs from getItem API';
COMMENT ON COLUMN pipeline.listings.condition_description IS 'Detailed condition description from getItem API';
COMMENT ON COLUMN pipeline.listings.category_path IS 'Full category hierarchy path from getItem API';
COMMENT ON COLUMN pipeline.listings.item_location IS 'Structured location data (city, state, country, postal code) from getItem API';
COMMENT ON COLUMN pipeline.listings.estimated_availabilities IS 'Stock/quantity information from getItem API';
COMMENT ON COLUMN pipeline.listings.buying_options IS 'Array of buying options (e.g., FIXED_PRICE, BEST_OFFER) from getItem API';

