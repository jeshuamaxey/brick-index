// Server-side authentication and authorization helpers
// These functions work with Supabase SSR to check authentication and permissions

import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { supabaseServer } from '@/lib/supabase/server';
import { createServiceLogger } from '@/lib/logging';
import type { Database } from '@/lib/supabase/supabase.types';

const log = createServiceLogger('AuthHelpers');

/**
 * Get the authenticated user session from the server
 * Returns null if not authenticated
 */
export async function getServerSession() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return null;
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
          // Not needed for reading auth state
        },
      },
    }
  );

  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    return null;
  }

  return { user, supabase };
}

/**
 * Require authentication, throw error if not authenticated
 */
export async function requireAuth() {
  const session = await getServerSession();
  if (!session) {
    throw new Error('Authentication required');
  }
  return session;
}

/**
 * Check if a user has a specific permission
 * Uses the database helper function for efficient checking
 */
export async function hasPermission(
  userId: string,
  permission: string
): Promise<boolean> {
  try {
    // Cast permission to app_permission enum type for RPC call
    const { data, error } = await supabaseServer.rpc('user_has_permission', {
      p_user_id: userId,
      p_permission_name: permission as any, // Type assertion needed due to enum constraint
    });

    if (error) {
      log.warn({ err: error, userId, permission }, 'Error checking permission');
      return false;
    }

    return data === true;
  } catch (error) {
    log.warn({ err: error, userId, permission }, 'Error checking permission');
    return false;
  }
}

/**
 * Require a specific permission, throw error if user doesn't have it
 */
export async function requirePermission(permission: string) {
  const session = await requireAuth();
  const hasPerm = await hasPermission(session.user.id, permission);
  
  if (!hasPerm) {
    throw new Error(`Permission required: ${permission}`);
  }
  
  return session;
}

/**
 * Get all groups a user belongs to
 */
export async function getUserGroups(userId: string) {
  try {
    const { data, error } = await supabaseServer.rpc('user_groups', {
      p_user_id: userId,
    });

    if (error) {
      log.warn({ err: error, userId }, 'Error getting user groups');
      return [];
    }

    return data || [];
  } catch (error) {
    log.warn({ err: error, userId }, 'Error getting user groups');
    return [];
  }
}

/**
 * Get all permissions a user has (across all groups)
 */
export async function getUserPermissions(userId: string): Promise<string[]> {
  try {
    const { data, error } = await supabaseServer.rpc('user_permissions', {
      p_user_id: userId,
    });

    if (error) {
      log.warn({ err: error, userId }, 'Error getting user permissions');
      return [];
    }

    // The function returns an array of objects with permission_name
    if (Array.isArray(data)) {
      return data.map((p: { permission_name: string }) => p.permission_name);
    }
    return [];
  } catch (error) {
    log.warn({ err: error, userId }, 'Error getting user permissions');
    return [];
  }
}

/**
 * Check if a user belongs to a specific group
 */
export async function isUserInGroup(
  userId: string,
  groupId: string
): Promise<boolean> {
  try {
    const { data, error } = await supabaseServer.rpc('is_user_in_group', {
      p_user_id: userId,
      p_group_id: groupId,
    });

    if (error) {
      log.warn({ err: error, userId, groupId }, 'Error checking group membership');
      return false;
    }

    return data === true;
  } catch (error) {
    log.warn({ err: error, userId, groupId }, 'Error checking group membership');
    return false;
  }
}
