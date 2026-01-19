-- Create raw_listing_details table for enrichment data
-- This table stores enriched item details from getItem API, linked to raw_listings from search API

CREATE TABLE pipeline.raw_listing_details (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  raw_listing_id UUID REFERENCES pipeline.raw_listings(id) ON DELETE CASCADE NOT NULL,
  job_id UUID REFERENCES pipeline.jobs(id),
  marketplace TEXT NOT NULL,
  api_response JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(raw_listing_id)
);

-- Add indexes for efficient querying
CREATE INDEX idx_raw_listing_details_raw_listing_id ON pipeline.raw_listing_details(raw_listing_id);
CREATE INDEX idx_raw_listing_details_job_id ON pipeline.raw_listing_details(job_id);
CREATE INDEX idx_raw_listing_details_marketplace ON pipeline.raw_listing_details(marketplace);

-- Add comment
COMMENT ON TABLE pipeline.raw_listing_details IS 'Stores enriched item details from getItem API, linked to raw_listings from search API';
COMMENT ON COLUMN pipeline.raw_listing_details.raw_listing_id IS 'Reference to the raw_listings record from search API';
COMMENT ON COLUMN pipeline.raw_listing_details.job_id IS 'Reference to the enrich job that created this record';
COMMENT ON COLUMN pipeline.raw_listing_details.api_response IS 'Full JSON response from getItem API endpoint';
