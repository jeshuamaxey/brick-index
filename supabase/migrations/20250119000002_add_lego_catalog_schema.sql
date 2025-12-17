-- Create catalog schema for LEGO sets catalog data

CREATE SCHEMA IF NOT EXISTS catalog;

-- ============================================================================
-- CATALOG SCHEMA: LEGO Sets Catalog
-- ============================================================================

-- LEGO sets catalog table
CREATE TABLE catalog.lego_sets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  set_num TEXT NOT NULL UNIQUE, -- Official LEGO set number (e.g., "75192-1")
  name TEXT NOT NULL,
  year INTEGER,
  theme_id INTEGER, -- Reference to catalog.themes
  num_parts INTEGER, -- Official piece count
  set_img_url TEXT, -- Official set image URL
  set_url TEXT, -- Official LEGO.com URL
  last_modified TIMESTAMP, -- When Rebrickable last updated this set
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Themes table for LEGO theme hierarchy
CREATE TABLE catalog.themes (
  id INTEGER PRIMARY KEY, -- Rebrickable theme ID
  name TEXT NOT NULL,
  parent_id INTEGER, -- Parent theme reference (self-referential)
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  FOREIGN KEY (parent_id) REFERENCES catalog.themes(id) ON DELETE SET NULL
);

-- CSV file metadata for change detection
CREATE TABLE catalog.csv_file_metadata (
  filename TEXT PRIMARY KEY, -- e.g., 'sets.csv.gz', 'themes.csv.gz'
  etag TEXT, -- HTTP ETag from last successful download (quoted format)
  last_modified TIMESTAMP, -- Last-Modified header value from server
  content_length BIGINT, -- File size in bytes
  last_checked_at TIMESTAMP, -- When we last checked for changes
  last_downloaded_at TIMESTAMP, -- When we last successfully downloaded
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for lego_sets
CREATE INDEX idx_lego_sets_set_num ON catalog.lego_sets(set_num);
CREATE INDEX idx_lego_sets_year ON catalog.lego_sets(year);
CREATE INDEX idx_lego_sets_theme_id ON catalog.lego_sets(theme_id);
CREATE INDEX idx_lego_sets_name ON catalog.lego_sets(name); -- For text search

-- Create indexes for themes
CREATE INDEX idx_themes_parent_id ON catalog.themes(parent_id);

-- Create index for csv_file_metadata (filename is already primary key, but add index for lookups)
-- Note: Primary key already creates an index, but we'll add one for last_checked_at queries
CREATE INDEX idx_csv_file_metadata_last_checked ON catalog.csv_file_metadata(last_checked_at);

-- Function to automatically update updated_at timestamp (in catalog schema)
CREATE OR REPLACE FUNCTION catalog.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updated_at in catalog schema
CREATE TRIGGER update_lego_sets_updated_at 
  BEFORE UPDATE ON catalog.lego_sets
  FOR EACH ROW EXECUTE FUNCTION catalog.update_updated_at_column();

CREATE TRIGGER update_themes_updated_at 
  BEFORE UPDATE ON catalog.themes
  FOR EACH ROW EXECUTE FUNCTION catalog.update_updated_at_column();

CREATE TRIGGER update_csv_file_metadata_updated_at 
  BEFORE UPDATE ON catalog.csv_file_metadata
  FOR EACH ROW EXECUTE FUNCTION catalog.update_updated_at_column();

-- Grant necessary permissions on catalog schema
GRANT USAGE ON SCHEMA catalog TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA catalog TO anon, authenticated, service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA catalog TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA catalog TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA catalog GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA catalog GRANT ALL ON ROUTINES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA catalog GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;

-- Add comments for documentation
COMMENT ON SCHEMA catalog IS 'Schema for LEGO sets catalog data from Rebrickable';
COMMENT ON TABLE catalog.lego_sets IS 'Official LEGO sets catalog with metadata from Rebrickable';
COMMENT ON TABLE catalog.themes IS 'LEGO theme hierarchy from Rebrickable';
COMMENT ON TABLE catalog.csv_file_metadata IS 'Metadata for CSV files to enable change detection via HTTP conditional requests';
