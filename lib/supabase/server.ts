// Supabase client for server-side operations with admin access
// This client uses the service role key which bypasses Row Level Security (RLS)
// Required for operations that need to access RLS-protected tables

import { createClient } from '@supabase/supabase-js';
import type { Database } from './supabase.types';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl) {
  throw new Error(
    'Missing Supabase environment variable: NEXT_PUBLIC_SUPABASE_URL is required'
  );
}

if (!supabaseServiceRoleKey) {
  throw new Error(
    'Missing Supabase environment variable: SUPABASE_SERVICE_ROLE_KEY is required for admin operations. ' +
    'This client bypasses RLS and is needed for server-side operations on protected tables.'
  );
}

// Use service role key for admin operations (bypasses RLS)
export const supabaseServer = createClient<Database>(
  supabaseUrl,
  supabaseServiceRoleKey,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

