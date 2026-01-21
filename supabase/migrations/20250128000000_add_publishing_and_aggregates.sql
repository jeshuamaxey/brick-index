-- Migration: Add publishing controls and analytics schema for consumer experience
-- This migration adds:
-- 1. published_themes table for theme-level publishing control
-- 2. publish_override column on lego_sets for individual set overrides
-- 3. analytics schema for derived/computed data
-- 4. set_price_aggregates materialized view in analytics schema

-- =============================================================================
-- 1. Create published_themes table
-- =============================================================================

CREATE TABLE catalog.published_themes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  theme_id INTEGER NOT NULL REFERENCES catalog.themes(id),
  is_published BOOLEAN NOT NULL DEFAULT false,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(theme_id)
);

-- Add comment for documentation
COMMENT ON TABLE catalog.published_themes IS 'Controls which themes are published for consumer viewing';
COMMENT ON COLUMN catalog.published_themes.is_published IS 'Whether sets in this theme are visible to consumers';
COMMENT ON COLUMN catalog.published_themes.published_at IS 'When the theme was last published';

-- Create index for efficient lookups
CREATE INDEX idx_published_themes_is_published ON catalog.published_themes(is_published) WHERE is_published = true;

-- =============================================================================
-- 2. Add publish_override column to lego_sets
-- =============================================================================

ALTER TABLE catalog.lego_sets 
ADD COLUMN publish_override BOOLEAN DEFAULT NULL;

-- Add comment for documentation
COMMENT ON COLUMN catalog.lego_sets.publish_override IS 'Individual set publishing override: NULL = inherit from theme, TRUE = force publish, FALSE = force unpublish';

-- Create index for efficient filtering
CREATE INDEX idx_lego_sets_publish_override ON catalog.lego_sets(publish_override) WHERE publish_override IS NOT NULL;

-- =============================================================================
-- 3. Create analytics schema for derived/computed data
-- =============================================================================

CREATE SCHEMA IF NOT EXISTS analytics;

COMMENT ON SCHEMA analytics IS 'Schema for derived analytics, aggregates, and computed views. Source data lives in pipeline/catalog; this schema contains insights derived from that data.';

-- Grant necessary permissions on analytics schema
GRANT USAGE ON SCHEMA analytics TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA analytics TO anon, authenticated, service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA analytics TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA analytics TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA analytics GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA analytics GRANT ALL ON ROUTINES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA analytics GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;

-- =============================================================================
-- 4. Create set_price_aggregates materialized view in analytics schema
-- =============================================================================

CREATE MATERIALIZED VIEW analytics.set_price_aggregates AS
SELECT 
  ls.id as lego_set_id,
  ls.set_num,
  COUNT(DISTINCT l.id) as listing_count,
  COALESCE(AVG(l.price), 0) as avg_price,
  MIN(l.price) as min_price,
  MAX(l.price) as max_price,
  PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY l.price) as median_price,
  COALESCE(AVG(la.price_per_piece), 0) as avg_price_per_piece,
  MAX(l.last_seen_at) as last_listing_seen_at
FROM catalog.lego_sets ls
LEFT JOIN pipeline.listing_lego_set_joins llsj ON llsj.lego_set_id = ls.id AND llsj.status = 'active'
LEFT JOIN pipeline.listings l ON l.id = llsj.listing_id
LEFT JOIN pipeline.listing_analysis la ON la.listing_id = l.id
GROUP BY ls.id, ls.set_num;

-- Create unique index for efficient lookups and REFRESH CONCURRENTLY support
CREATE UNIQUE INDEX idx_set_price_aggregates_lego_set_id ON analytics.set_price_aggregates(lego_set_id);
CREATE INDEX idx_set_price_aggregates_set_num ON analytics.set_price_aggregates(set_num);

-- Add comment for documentation
COMMENT ON MATERIALIZED VIEW analytics.set_price_aggregates IS 'Pre-computed aggregate pricing data for LEGO sets, refreshed periodically. Derives from pipeline.listings joined to catalog.lego_sets.';

-- =============================================================================
-- 5. Create function to refresh the materialized view
-- =============================================================================

CREATE OR REPLACE FUNCTION analytics.refresh_set_price_aggregates()
RETURNS void AS $$
BEGIN
  -- Try concurrent refresh first (doesn't block reads)
  BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY analytics.set_price_aggregates;
  EXCEPTION WHEN OTHERS THEN
    -- Fall back to non-concurrent refresh if concurrent fails
    -- (e.g., when the view is empty or doesn't have a unique index)
    REFRESH MATERIALIZED VIEW analytics.set_price_aggregates;
  END;
END;
$$ LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = analytics, catalog, pipeline, public;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION analytics.refresh_set_price_aggregates() TO authenticated;

COMMENT ON FUNCTION analytics.refresh_set_price_aggregates() IS 'Refreshes the set_price_aggregates materialized view. Uses SECURITY DEFINER to run with owner privileges. Tries CONCURRENTLY first, falls back to regular refresh.';

-- =============================================================================
-- 6. Create helper function to get published sets (stays in catalog)
-- =============================================================================

CREATE OR REPLACE FUNCTION catalog.get_published_sets()
RETURNS TABLE (
  id UUID,
  set_num TEXT,
  name TEXT,
  year INTEGER,
  theme_id INTEGER,
  num_parts INTEGER,
  set_img_url TEXT,
  set_url TEXT,
  publish_override BOOLEAN,
  is_theme_published BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ls.id,
    ls.set_num,
    ls.name,
    ls.year,
    ls.theme_id,
    ls.num_parts,
    ls.set_img_url,
    ls.set_url,
    ls.publish_override,
    COALESCE(pt.is_published, false) as is_theme_published
  FROM catalog.lego_sets ls
  LEFT JOIN catalog.published_themes pt ON pt.theme_id = ls.theme_id
  WHERE 
    -- Include if: force published OR (inherit from theme AND theme is published)
    ls.publish_override = true 
    OR (ls.publish_override IS NULL AND COALESCE(pt.is_published, false) = true)
  ORDER BY ls.year DESC, ls.name ASC;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION catalog.get_published_sets() IS 'Returns all sets that should be visible to consumers based on publishing rules';

-- =============================================================================
-- 7. Enable RLS on published_themes (admin only)
-- =============================================================================

ALTER TABLE catalog.published_themes ENABLE ROW LEVEL SECURITY;

-- Allow read access to everyone (public can see which themes are published)
CREATE POLICY "published_themes_select_policy" ON catalog.published_themes
  FOR SELECT
  USING (true);

-- Write access requires backend.manage permission (checked at API level)
-- For now, allow service role full access
CREATE POLICY "published_themes_all_policy" ON catalog.published_themes
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
