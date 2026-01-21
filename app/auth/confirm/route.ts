// Email confirmation handler
// Handles email confirmation links with token_hash and redirects to /account

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import type { Database } from '@/lib/supabase/supabase.types';

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const tokenHash = requestUrl.searchParams.get('token_hash');
  const type = requestUrl.searchParams.get('type');
  const code = requestUrl.searchParams.get('code');
  // Check for redirect_to parameter (from Supabase) or next parameter (custom)
  const redirectTo = requestUrl.searchParams.get('redirect_to') || requestUrl.searchParams.get('next') || '/account';

  // Handle code-based flow (OAuth-style, already verified by Supabase)
  if (code) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.redirect(new URL('/auth/signin?error=config', requestUrl.origin));
    }

    const cookieStore = await cookies();
    const response = NextResponse.redirect(new URL(redirectTo, requestUrl.origin));

    const supabase = createServerClient<Database>(
      supabaseUrl,
      supabaseAnonKey,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
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

    // Exchange the code for a session
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      console.error('Error exchanging code for session:', error);
      return NextResponse.redirect(new URL('/auth/signin?error=auth_error', requestUrl.origin));
    }

    return response;
  }

  // Handle token_hash-based flow (direct email confirmation)
  if (tokenHash && type) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.redirect(new URL('/auth/signin?error=config', requestUrl.origin));
    }

    const cookieStore = await cookies();
    const response = NextResponse.redirect(new URL(redirectTo, requestUrl.origin));

    const supabase = createServerClient<Database>(
      supabaseUrl,
      supabaseAnonKey,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
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

    // Verify the token
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: type as 'email',
    });

    if (error) {
      console.error('Error verifying email:', error);
      return NextResponse.redirect(new URL('/auth/signin?error=verification_failed', requestUrl.origin));
    }

    return response;
  }

  // No token provided, redirect to sign in
  return NextResponse.redirect(new URL('/auth/signin', requestUrl.origin));
}
