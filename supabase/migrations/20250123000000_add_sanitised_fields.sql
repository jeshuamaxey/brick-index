-- Add sanitised fields to listings table

-- Add sanitised title and description columns
ALTER TABLE pipeline.listings
  ADD COLUMN IF NOT EXISTS sanitised_title TEXT,
  ADD COLUMN IF NOT EXISTS sanitised_description TEXT,
  ADD COLUMN IF NOT EXISTS sanitised_at TIMESTAMP;

-- Add index on sanitised_at for efficient querying of unsanitized listings
CREATE INDEX IF NOT EXISTS idx_listings_sanitised_at ON pipeline.listings(sanitised_at);

-- Add comments explaining the sanitised fields
COMMENT ON COLUMN pipeline.listings.sanitised_title IS 'Sanitised version of title with HTML markup removed';
COMMENT ON COLUMN pipeline.listings.sanitised_description IS 'Sanitised version of description with HTML markup, images, scripts, and styles removed';
COMMENT ON COLUMN pipeline.listings.sanitised_at IS 'Timestamp when listing was sanitized';
