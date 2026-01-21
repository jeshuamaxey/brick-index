// API endpoint to check authentication status

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { supabaseServer } from '@/lib/supabase/server';
import type { Database } from '@/lib/supabase/supabase.types';

export async function GET(request: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json({ authenticated: false });
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
            // Not needed for GET requests
          },
        },
      }
    );

    const { data: { user }, error } = await supabase.auth.getUser();

    if (error || !user) {
      return NextResponse.json({
        authenticated: false,
        user: null,
        groups: [],
        permissions: [],
        canAccessBackend: false,
      });
    }

    // Get user groups
    const { data: groups, error: groupsError } = await supabaseServer.rpc('user_groups', {
      p_user_id: user.id,
    });

    // Get user permissions
    const { data: permissions, error: permissionsError } = await supabaseServer.rpc('user_permissions', {
      p_user_id: user.id,
    });

    const permissionNames = (permissions || []).map((p: { permission_name: string }) => p.permission_name);
    const canAccessBackend = permissionNames.includes('backend.access');

    return NextResponse.json({
      authenticated: true,
      user: {
        id: user.id,
        email: user.email,
      },
      groups: groups || [],
      permissions: permissionNames,
      canAccessBackend,
    });
  } catch (error) {
    return NextResponse.json({
      authenticated: false,
      user: null,
      groups: [],
      permissions: [],
      canAccessBackend: false,
    });
  }
}
