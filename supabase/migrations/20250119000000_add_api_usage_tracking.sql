-- Add API usage tracking for eBay Browse API rate limits
-- Tracks calls per application ID and endpoint type

-- Create endpoint_type enum for eBay Browse API endpoints
CREATE TYPE pipeline.ebay_endpoint_type AS ENUM (
  'item_summary_search',  -- All methods except getItems (5,000/day limit)
  'get_item'              -- getItems endpoint (5,000/day limit)
);

-- API usage tracking table
CREATE TABLE pipeline.ebay_api_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  app_id TEXT NOT NULL,  -- eBay Application ID
  endpoint_type pipeline.ebay_endpoint_type NOT NULL,
  called_at TIMESTAMP DEFAULT NOW() NOT NULL,
  -- Response headers (if available from eBay)
  rate_limit_limit INTEGER,        -- X-RateLimit-Limit or similar
  rate_limit_remaining INTEGER,     -- X-RateLimit-Remaining or similar
  rate_limit_reset TIMESTAMP,       -- X-RateLimit-Reset or similar
  response_status INTEGER,           -- HTTP status code
  response_headers JSONB,            -- Store all response headers for future analysis
  -- Metadata
  error_message TEXT,                -- If call failed
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Indexes for efficient querying
CREATE INDEX idx_ebay_api_usage_app_id ON pipeline.ebay_api_usage(app_id);
CREATE INDEX idx_ebay_api_usage_endpoint_type ON pipeline.ebay_api_usage(endpoint_type);
CREATE INDEX idx_ebay_api_usage_called_at ON pipeline.ebay_api_usage(called_at DESC);
-- Composite index for common queries: app_id + endpoint_type + called_at
CREATE INDEX idx_ebay_api_usage_app_endpoint_time ON pipeline.ebay_api_usage(app_id, endpoint_type, called_at DESC);

-- Function to get usage statistics for a given app_id and time window
CREATE OR REPLACE FUNCTION pipeline.get_ebay_api_usage_stats(
  p_app_id TEXT,
  p_hours INTEGER DEFAULT 24
)
RETURNS TABLE(
  endpoint_type pipeline.ebay_endpoint_type,
  total_calls BIGINT,
  successful_calls BIGINT,
  failed_calls BIGINT,
  calls_in_last_24h BIGINT,
  limit_per_day INTEGER,
  percentage_used NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  WITH usage_stats AS (
    SELECT 
      u.endpoint_type,
      COUNT(*) as total_calls,
      COUNT(*) FILTER (WHERE u.response_status >= 200 AND u.response_status < 300) as successful_calls,
      COUNT(*) FILTER (WHERE u.response_status < 200 OR u.response_status >= 300) as failed_calls,
      COUNT(*) FILTER (WHERE u.called_at >= NOW() - INTERVAL '24 hours') as calls_in_last_24h
    FROM pipeline.ebay_api_usage u
    WHERE u.app_id = p_app_id
      AND u.called_at >= NOW() - (p_hours || ' hours')::INTERVAL
    GROUP BY u.endpoint_type
  ),
  all_endpoints AS (
    SELECT 'item_summary_search'::pipeline.ebay_endpoint_type as endpoint_type
    UNION ALL
    SELECT 'get_item'::pipeline.ebay_endpoint_type
  )
  SELECT 
    ae.endpoint_type,
    COALESCE(us.total_calls, 0)::BIGINT as total_calls,
    COALESCE(us.successful_calls, 0)::BIGINT as successful_calls,
    COALESCE(us.failed_calls, 0)::BIGINT as failed_calls,
    COALESCE(us.calls_in_last_24h, 0)::BIGINT as calls_in_last_24h,
    5000 as limit_per_day,  -- Both endpoints have 5,000/day limit
    ROUND(
      (COALESCE(us.calls_in_last_24h, 0)::NUMERIC / 5000.0) * 100.0,
      2
    ) as percentage_used
  FROM all_endpoints ae
  LEFT JOIN usage_stats us ON ae.endpoint_type = us.endpoint_type
  ORDER BY ae.endpoint_type;
END;
$$ LANGUAGE plpgsql;

-- Grant permissions
GRANT EXECUTE ON FUNCTION pipeline.get_ebay_api_usage_stats(TEXT, INTEGER) TO anon, authenticated, service_role;

-- Create a public schema wrapper function for PostgREST RPC access
-- PostgREST only exposes functions in the public schema via RPC
CREATE OR REPLACE FUNCTION public.get_ebay_api_usage_stats(
  p_app_id TEXT,
  p_hours INTEGER DEFAULT 24
)
RETURNS TABLE(
  endpoint_type pipeline.ebay_endpoint_type,
  total_calls BIGINT,
  successful_calls BIGINT,
  failed_calls BIGINT,
  calls_in_last_24h BIGINT,
  limit_per_day INTEGER,
  percentage_used NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT * FROM pipeline.get_ebay_api_usage_stats(p_app_id, p_hours);
END;
$$ LANGUAGE plpgsql;

-- Grant permissions on the public wrapper
GRANT EXECUTE ON FUNCTION public.get_ebay_api_usage_stats(TEXT, INTEGER) TO anon, authenticated, service_role;

-- Add comments
COMMENT ON TABLE pipeline.ebay_api_usage IS 'Tracks eBay Browse API calls for rate limit monitoring. Limits: item_summary_search (5,000/day), get_item (5,000/day)';
COMMENT ON COLUMN pipeline.ebay_api_usage.app_id IS 'eBay Application ID - limits are tied to this';
COMMENT ON COLUMN pipeline.ebay_api_usage.endpoint_type IS 'Type of endpoint called (item_summary_search or get_item)';
COMMENT ON COLUMN pipeline.ebay_api_usage.rate_limit_limit IS 'Rate limit header value if provided by eBay API';
COMMENT ON COLUMN pipeline.ebay_api_usage.rate_limit_remaining IS 'Remaining calls header value if provided by eBay API';
COMMENT ON COLUMN pipeline.ebay_api_usage.rate_limit_reset IS 'Rate limit reset time header value if provided by eBay API';
