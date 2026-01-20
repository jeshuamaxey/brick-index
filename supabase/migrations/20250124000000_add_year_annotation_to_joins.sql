-- Add potential_year_match column to listing_lego_set_joins table
-- This flag annotates joins where the set_num prefix is in the 1990-2050 range
-- for analysis of potential false positives from years

ALTER TABLE pipeline.listing_lego_set_joins
  ADD COLUMN IF NOT EXISTS potential_year_match BOOLEAN NOT NULL DEFAULT false;

-- Create index for efficient querying of year-like matches
CREATE INDEX IF NOT EXISTS idx_listing_lego_set_joins_potential_year_match 
  ON pipeline.listing_lego_set_joins(potential_year_match);

-- Add comment
COMMENT ON COLUMN pipeline.listing_lego_set_joins.potential_year_match IS 'Flag indicating if the matched set_num prefix is in the 1990-2050 range (potential year false positive)';
