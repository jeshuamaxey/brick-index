import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';
import type { Database } from '@/lib/supabase/supabase.types';

// Note: Edge middleware cannot use Pino (Node.js only). Use console for minimal Edge logging.

export async function middleware(request: NextRequest) {
  // Only protect /backend/* routes
  if (!request.nextUrl.pathname.startsWith('/backend')) {
    return NextResponse.next();
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    // If Supabase is not configured, allow access (for development)
    return NextResponse.next();
  }

  // Create a response object
  const response = NextResponse.next();

  // Create Supabase client with cookie handling
  const supabase = createServerClient<Database>(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value);
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

  // Check authentication
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    // Not authenticated - redirect to sign in
    const signInUrl = new URL('/auth/signin', request.url);
    signInUrl.searchParams.set('redirect', request.nextUrl.pathname);
    return NextResponse.redirect(signInUrl);
  }

  // Check if user has backend.access permission
  try {
    const { data: hasPermission, error: permError } = await supabaseServer.rpc(
      'user_has_permission',
      {
        p_user_id: user.id,
        p_permission_name: 'backend.access',
      }
    );

    if (permError || !hasPermission) {
      // User doesn't have permission - redirect to sign in
      const signInUrl = new URL('/auth/signin', request.url);
      signInUrl.searchParams.set('error', 'permission_denied');
      return NextResponse.redirect(signInUrl);
    }
  } catch (error) {
    // Error checking permission - redirect to sign in for safety
    // Note: Using console here because Edge middleware cannot use Pino
    // eslint-disable-next-line no-console
    console.error('[Auth Middleware] Error checking permission:', { userId: user.id, error });
    const signInUrl = new URL('/auth/signin', request.url);
    signInUrl.searchParams.set('error', 'auth_error');
    return NextResponse.redirect(signInUrl);
  }

  // User is authenticated and has permission - allow access
  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder files
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
