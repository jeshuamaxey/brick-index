'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Blocks, LogOut, User, Settings } from 'lucide-react';

interface ConsumerHeaderProps {
  isAuthenticated: boolean;
  userEmail?: string | null;
  canAccessBackend?: boolean;
}

export function ConsumerHeader({ isAuthenticated, userEmail, canAccessBackend }: ConsumerHeaderProps) {
  const router = useRouter();

  const handleSignOut = async () => {
    try {
      await fetch('/api/auth/signout', { method: 'POST' });
      router.refresh();
    } catch (error) {
      console.error('Sign out error:', error);
    }
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b border-foreground/10 backdrop-blur-md bg-background/80">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        {/* Logo / Brand */}
        <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
          <div className="p-1.5 rounded-lg bg-brand/10 border border-brand/20">
            <Blocks className="h-5 w-5 text-brand" />
          </div>
          <span className="font-semibold text-foreground">Brick Index</span>
        </Link>

        {/* Navigation */}
        <nav className="hidden md:flex items-center gap-6">
          <Link 
            href="/" 
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            All Sets
          </Link>
          {canAccessBackend && (
            <Link 
              href="/backend" 
              className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1.5"
            >
              <Settings className="h-3.5 w-3.5" />
              Backend
            </Link>
          )}
        </nav>

        {/* Auth Section */}
        <div className="flex items-center gap-3">
          {isAuthenticated ? (
            <>
              <div className="hidden sm:flex items-center gap-2 text-sm text-muted-foreground">
                <User className="h-4 w-4" />
                <span>{userEmail}</span>
              </div>
              <Button 
                variant="outline" 
                size="sm"
                onClick={handleSignOut}
                className="border-foreground/20"
              >
                <LogOut className="h-4 w-4 mr-2" />
                Sign Out
              </Button>
            </>
          ) : (
            <>
              <Link href="/auth/signin">
                <Button variant="ghost" size="sm">
                  Sign In
                </Button>
              </Link>
              <Link href="/auth/signup">
                <Button 
                  size="sm"
                  className="bg-brand text-brand-foreground hover:bg-brand/90"
                >
                  Sign Up Free
                </Button>
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
