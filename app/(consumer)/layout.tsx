// Consumer layout - publicly accessible with auth-aware content
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import type { Database } from '@/lib/supabase/supabase.types';
import { ConsumerHeader } from './components/consumer-header';
import { AuthProvider } from './components/auth-context';
import { hasPermission } from '@/lib/auth/auth-helpers';

async function getAuthStatus() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      return { isAuthenticated: false, user: null, canAccessBackend: false };
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
      return { isAuthenticated: false, user: null, canAccessBackend: false };
    }

    // Check if user has backend access permission
    const canAccessBackend = await hasPermission(user.id, 'backend.access');

    return {
      isAuthenticated: true,
      user: {
        id: user.id,
        email: user.email || null,
      },
      canAccessBackend,
    };
  } catch {
    return { isAuthenticated: false, user: null, canAccessBackend: false };
  }
}

export default async function ConsumerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isAuthenticated, user, canAccessBackend } = await getAuthStatus();

  return (
    <AuthProvider isAuthenticated={isAuthenticated} user={user} canAccessBackend={canAccessBackend}>
      <div className="min-h-screen bg-background">
        <ConsumerHeader isAuthenticated={isAuthenticated} userEmail={user?.email} canAccessBackend={canAccessBackend} />
        <main className="container mx-auto px-4 py-8">
          {children}
        </main>
        <footer className="border-t border-foreground/10 py-8 mt-16">
          <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
            <p>LEGO Modular Building Price Tracker</p>
            <p className="mt-2">Data sourced from marketplace listings. Prices may vary.</p>
          </div>
        </footer>
      </div>
    </AuthProvider>
  );
}
