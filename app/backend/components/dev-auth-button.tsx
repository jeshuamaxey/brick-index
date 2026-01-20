'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';

export function DevAuthButton() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSigningIn, setIsSigningIn] = useState(false);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const response = await fetch('/api/auth/status');
      if (response.ok) {
        const data = await response.json();
        setIsAuthenticated(data.authenticated || false);
      }
    } catch (error) {
      console.error('Error checking auth:', error);
      setIsAuthenticated(false);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignIn = async () => {
    setIsSigningIn(true);
    try {
      const response = await fetch('/api/auth/dev-signin', {
        method: 'POST',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to sign in');
      }

      // Refresh the page to update auth state
      window.location.reload();
    } catch (error) {
      console.error('Error signing in:', error);
      alert(error instanceof Error ? error.message : 'Failed to sign in');
    } finally {
      setIsSigningIn(false);
    }
  };

  if (isLoading) {
    return (
      <Button variant="outline" size="sm" disabled>
        Checking...
      </Button>
    );
  }

  if (isAuthenticated) {
    return (
      <Button variant="outline" size="sm" disabled>
        ✓ Signed In
      </Button>
    );
  }

  return (
    <Button
      variant="default"
      size="sm"
      onClick={handleSignIn}
      disabled={isSigningIn}
    >
      {isSigningIn ? 'Signing In...' : 'Sign In (Dev)'}
    </Button>
  );
}
