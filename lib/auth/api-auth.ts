// Helper functions for API authentication

import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import type { Database } from '@/lib/supabase/supabase.types';

export interface AuthResult {
  isAuthenticated: boolean;
  userId: string | null;
}

/**
 * Check if the request is authenticated
 * Returns user info if authenticated, null otherwise
 */
export async function getAuthStatus(): Promise<AuthResult> {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      return { isAuthenticated: false, userId: null };
    }

    const cookieStore = await cookies();
    const supabase = createServerClient<Database>(
      supabaseUrl,
      supabaseAnonKey,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll() {
            // Not needed for read operations
          },
        },
      }
    );

    const { data: { user }, error } = await supabase.auth.getUser();

    if (error || !user) {
      return { isAuthenticated: false, userId: null };
    }

    return { isAuthenticated: true, userId: user.id };
  } catch (error) {
    return { isAuthenticated: false, userId: null };
  }
}
