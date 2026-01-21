-- Fix oauth_client_id column issue
-- This migration ensures the oauth_client_id column is nullable to prevent session errors

-- Check if the column exists and make it nullable if it does
DO $$
BEGIN
  -- Check if oauth_client_id column exists in auth.sessions
  IF EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_schema = 'auth' 
    AND table_name = 'sessions' 
    AND column_name = 'oauth_client_id'
  ) THEN
    -- Make the column nullable if it's not already
    ALTER TABLE auth.sessions 
    ALTER COLUMN oauth_client_id DROP NOT NULL;
    
    -- Set NULL values for existing rows if needed
    UPDATE auth.sessions 
    SET oauth_client_id = NULL 
    WHERE oauth_client_id IS NOT NULL 
    AND oauth_client_id NOT IN (SELECT id FROM auth.clients);
  END IF;
END $$;
