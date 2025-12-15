-- Table to store eBay marketplace account deletion/closure notifications
-- See eBay docs: https://developer.ebay.com/develop/guides-v2/marketplace-user-account-deletion/marketplace-user-account-deletion#overview

create table if not exists public.ebay_marketplace_account_deletion_notifications (
  -- Core notification metadata
  notification_id text primary key,
  created_at timestamptz not null default now(),
  topic text,
  event_date timestamptz,
  publish_date timestamptz,
  publish_attempt_count integer,

  -- User identifiers
  username text,
  user_id text,
  eias_token text,

  -- Signature and verification
  signature text,
  verified boolean not null default false,

  -- Full raw payload for audit/debugging
  raw_payload jsonb not null
);


