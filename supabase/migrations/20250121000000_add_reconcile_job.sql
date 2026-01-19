-- Add reconcile job type and create listing_lego_set_joins table

-- Add reconcile job type to the enum
ALTER TYPE pipeline.job_type ADD VALUE IF NOT EXISTS 'reconcile';

-- Create join table for linking listings to LEGO sets
CREATE TABLE pipeline.listing_lego_set_joins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID REFERENCES pipeline.listings(id) ON DELETE CASCADE NOT NULL,
  lego_set_id UUID REFERENCES catalog.lego_sets(id) ON DELETE CASCADE NOT NULL,
  nature TEXT NOT NULL DEFAULT 'mentioned',
  reconciliation_version TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create partial unique constraint (only for active status)
CREATE UNIQUE INDEX idx_listing_lego_set_joins_unique_active 
  ON pipeline.listing_lego_set_joins(listing_id, lego_set_id) 
  WHERE status = 'active';

-- Create indexes for efficient queries
CREATE INDEX idx_listing_lego_set_joins_listing_id 
  ON pipeline.listing_lego_set_joins(listing_id);
CREATE INDEX idx_listing_lego_set_joins_lego_set_id 
  ON pipeline.listing_lego_set_joins(lego_set_id);
CREATE INDEX idx_listing_lego_set_joins_reconciliation_version 
  ON pipeline.listing_lego_set_joins(reconciliation_version);
CREATE INDEX idx_listing_lego_set_joins_status 
  ON pipeline.listing_lego_set_joins(status);
CREATE INDEX idx_listing_lego_set_joins_listing_status 
  ON pipeline.listing_lego_set_joins(listing_id, status);

-- Add reconciliation tracking columns to listings table
ALTER TABLE pipeline.listings
  ADD COLUMN IF NOT EXISTS reconciled_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS reconciliation_version TEXT;

-- Create indexes for reconciliation tracking
CREATE INDEX IF NOT EXISTS idx_listings_reconciled_at 
  ON pipeline.listings(reconciled_at);
CREATE INDEX IF NOT EXISTS idx_listings_reconciliation_version 
  ON pipeline.listings(reconciliation_version);

-- Add comments
COMMENT ON TABLE pipeline.listing_lego_set_joins IS 'Join table linking listings to LEGO sets found in their titles/descriptions';
COMMENT ON COLUMN pipeline.listing_lego_set_joins.nature IS 'Nature of the relationship between listing and LEGO set (e.g., "mentioned", "included", "complete", "partial")';
COMMENT ON COLUMN pipeline.listing_lego_set_joins.reconciliation_version IS 'Version of reconciliation algorithm that created this join (e.g., "1.0.0")';
COMMENT ON COLUMN pipeline.listing_lego_set_joins.status IS 'Status of the join: active (current), superseded (replaced by newer version), or deprecated';
COMMENT ON COLUMN pipeline.listings.reconciled_at IS 'Timestamp when listing was processed by reconcile job. NULL indicates listing has not been reconciled.';
COMMENT ON COLUMN pipeline.listings.reconciliation_version IS 'Version of reconciliation algorithm used (e.g., "1.0.0"). Allows re-running listings when logic is improved.';
COMMENT ON TYPE pipeline.job_type IS 'Job types: ebay_refresh_listings, ebay_materialize_listings, ebay_enrich_listings, analyze_listings, lego_catalog_refresh, reconcile';
