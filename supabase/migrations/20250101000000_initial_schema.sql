-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create pipeline schema for analysis pipeline data
CREATE SCHEMA IF NOT EXISTS pipeline;

-- ============================================================================
-- PIPELINE SCHEMA: Analysis pipeline data
-- ============================================================================

-- Raw API responses (ground truth)
CREATE TABLE pipeline.raw_listings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP DEFAULT NOW(),
  marketplace TEXT NOT NULL,
  api_response JSONB NOT NULL
);

-- Structured listings derived from raw_listings
CREATE TABLE pipeline.listings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  raw_listing_id UUID REFERENCES pipeline.raw_listings(id) NOT NULL,
  marketplace TEXT NOT NULL,
  external_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  price DECIMAL,
  currency TEXT,
  url TEXT NOT NULL,
  image_urls TEXT[],
  location TEXT,
  seller_name TEXT,
  seller_rating DECIMAL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  first_seen_at TIMESTAMP DEFAULT NOW(),
  last_seen_at TIMESTAMP DEFAULT NOW(),
  status TEXT DEFAULT 'active',
  UNIQUE(marketplace, external_id)
);

-- Analysis results for listings
CREATE TABLE pipeline.listing_analysis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID REFERENCES pipeline.listings(id) ON DELETE CASCADE NOT NULL,
  piece_count INTEGER,
  estimated_piece_count BOOLEAN DEFAULT false,
  minifig_count INTEGER,
  estimated_minifig_count BOOLEAN DEFAULT false,
  condition TEXT DEFAULT 'unknown',
  price_per_piece DECIMAL,
  analysis_metadata JSONB,
  analyzed_at TIMESTAMP DEFAULT NOW(),
  analysis_version TEXT DEFAULT '1.0.0'
);

-- Capture job logs
CREATE TABLE pipeline.capture_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  marketplace TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('running', 'completed', 'failed')),
  listings_found INTEGER DEFAULT 0,
  listings_new INTEGER DEFAULT 0,
  listings_updated INTEGER DEFAULT 0,
  started_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP,
  error_message TEXT
);

-- Create indexes for pipeline tables
CREATE INDEX idx_listings_marketplace_external_id ON pipeline.listings(marketplace, external_id);
CREATE INDEX idx_listings_status ON pipeline.listings(status);
CREATE INDEX idx_listing_analysis_listing_id ON pipeline.listing_analysis(listing_id);
CREATE INDEX idx_raw_listings_marketplace ON pipeline.raw_listings(marketplace);
CREATE INDEX idx_raw_listings_created_at ON pipeline.raw_listings(created_at);

-- Function to automatically update updated_at timestamp (in pipeline schema)
CREATE OR REPLACE FUNCTION pipeline.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger for listings updated_at
CREATE TRIGGER update_listings_updated_at 
  BEFORE UPDATE ON pipeline.listings
  FOR EACH ROW EXECUTE FUNCTION pipeline.update_updated_at_column();

-- ============================================================================
-- PUBLIC SCHEMA: End user application data
-- ============================================================================

-- User profiles (links to auth.users)
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- User searches (criteria for matching listings)
CREATE TABLE public.searches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  max_price_per_piece DECIMAL NOT NULL,
  email_alerts_enabled BOOLEAN DEFAULT true,
  alert_frequency TEXT DEFAULT 'daily' CHECK (alert_frequency IN ('daily', 'weekly')),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Matched listings for searches
CREATE TABLE public.search_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  search_id UUID REFERENCES public.searches(id) ON DELETE CASCADE NOT NULL,
  listing_id UUID REFERENCES pipeline.listings(id) ON DELETE CASCADE NOT NULL,
  notified_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(search_id, listing_id)
);

-- Create indexes for public schema tables
CREATE INDEX idx_searches_profile_id ON public.searches(profile_id);
CREATE INDEX idx_search_results_search_id ON public.search_results(search_id);
CREATE INDEX idx_search_results_listing_id ON public.search_results(listing_id);
CREATE INDEX idx_search_results_notified_at ON public.search_results(notified_at);

-- Function to automatically update updated_at timestamp (in public schema)
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updated_at in public schema
CREATE TRIGGER update_profiles_updated_at 
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_searches_updated_at 
  BEFORE UPDATE ON public.searches
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Grant necessary permissions on pipeline schema
-- Following Supabase docs: https://supabase.com/docs/guides/api/using-custom-schemas
GRANT USAGE ON SCHEMA pipeline TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA pipeline TO anon, authenticated, service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA pipeline TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA pipeline TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA pipeline GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA pipeline GRANT ALL ON ROUTINES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA pipeline GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
