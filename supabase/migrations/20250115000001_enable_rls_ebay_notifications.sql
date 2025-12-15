-- Enable Row Level Security on eBay marketplace account deletion notifications table
-- This prevents regular users from accessing or writing to this table
-- Service role (used by server-side API routes) will bypass RLS and can still access

ALTER TABLE public.ebay_marketplace_account_deletion_notifications 
  ENABLE ROW LEVEL SECURITY;

-- No policies are created, which means:
-- - Authenticated users cannot SELECT, INSERT, UPDATE, or DELETE
-- - Service role (with service_role key) bypasses RLS and can still access
-- This ensures only server-side code can interact with this table

