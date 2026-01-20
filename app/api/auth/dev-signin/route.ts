// Development-only endpoint for quick authentication
// Creates or gets a test user and signs them in

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { supabaseServer } from '@/lib/supabase/server';
import type { Database } from '@/lib/supabase/supabase.types';

const TEST_USER_EMAIL = 'dev-user@example.com';
const TEST_USER_PASSWORD = 'dev-password-123';

export async function POST(request: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json(
        { error: 'Supabase configuration missing' },
        { status: 500 }
      );
    }

    // Check if test user exists, create if not
    const { data: existingUsers } = await supabaseServer.auth.admin.listUsers();
    
    let testUserId: string | null = null;
    
    // Find existing test user
    if (existingUsers?.users) {
      const testUser = existingUsers.users.find(u => u.email === TEST_USER_EMAIL);
      if (testUser) {
        testUserId = testUser.id;
      }
    }

    // Create test user if it doesn't exist
    if (!testUserId) {
      const { data: newUser, error: createError } = await supabaseServer.auth.admin.createUser({
        email: TEST_USER_EMAIL,
        password: TEST_USER_PASSWORD,
        email_confirm: true,
      });

      if (createError) {
        throw new Error(`Failed to create test user: ${createError.message}`);
      }

      if (!newUser.user) {
        throw new Error('Failed to create test user: No user returned');
      }

      testUserId = newUser.user.id;
    }

    // Ensure profile exists
    await supabaseServer
      .schema('public')
      .from('profiles')
      .upsert({ id: testUserId }, { onConflict: 'id' });

    // Create response first
    const response = NextResponse.json({
      success: true,
      user: {
        id: testUserId,
        email: TEST_USER_EMAIL,
      },
      message: 'Signed in as development user',
    });

    // Create a server client that will set cookies on the response
    const cookieStore = await cookies();
    const supabase = createServerClient<Database>(
      supabaseUrl,
      supabaseAnonKey,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            // Set cookies on the response object
            cookiesToSet.forEach(({ name, value, options }) => {
              response.cookies.set(name, value, {
                ...options,
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'lax',
                path: '/',
              });
            });
          },
        },
      }
    );

    // Sign in with password - this will automatically set the session cookies
    const { data: authData, error: signInError } = await supabase.auth.signInWithPassword({
      email: TEST_USER_EMAIL,
      password: TEST_USER_PASSWORD,
    });

    if (signInError) {
      throw new Error(`Failed to sign in: ${signInError.message}`);
    }

    if (!authData.user) {
      throw new Error('Failed to sign in: No user returned');
    }

    return response;
  } catch (error) {
    console.error('Error in dev signin:', error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'Unknown error occurred',
      },
      { status: 500 }
    );
  }
}
