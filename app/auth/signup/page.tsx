'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/lib/supabase/client-browser';

export default function SignUpPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    // Validate passwords match
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    // Validate password length
    if (password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    setIsLoading(true);

    try {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/confirm?next=/account`,
        },
      });

      if (signUpError) {
        setError(signUpError.message || 'Failed to create account. Please try again.');
        setIsLoading(false);
        return;
      }

      if (data.user) {
        // Check if email confirmation is required
        if (data.user.email_confirmed_at === null) {
          // Email confirmation required - show message
          setSuccess(true);
        } else {
          // Email already confirmed (shouldn't happen with enable_confirmations=true, but handle it)
          setSuccess(true);
          setTimeout(() => {
            router.push('/auth/signin');
          }, 2000);
        }
      }
    } catch (err) {
      setError('An unexpected error occurred. Please try again.');
      setIsLoading(false);
    }
  };

  if (success) {
    return (
      <div className="w-full space-y-6">
        <div className="text-center">
          <h2 className="text-3xl font-bold">Check Your Email</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            We've sent a confirmation email to <strong>{email}</strong>
          </p>
          <p className="mt-4 text-sm text-muted-foreground">
            Please click the link in the email to confirm your account before signing in.
          </p>
          <p className="mt-4 text-xs text-muted-foreground">
            In development, check Inbucket at{' '}
            <a
              href="http://127.0.0.1:54324"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              http://127.0.0.1:54324
            </a>
          </p>
          <div className="mt-6">
            <Link href="/auth/signin">
              <Button variant="outline">Go to Sign In</Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full space-y-6">
      <div className="text-center">
        <h2 className="text-3xl font-bold">Sign Up</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Create an account to get started
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="rounded-md bg-destructive/15 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={isLoading}
            autoComplete="email"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            disabled={isLoading}
            autoComplete="new-password"
            minLength={6}
          />
          <p className="text-xs text-muted-foreground">
            Must be at least 6 characters
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="confirmPassword">Confirm Password</Label>
          <Input
            id="confirmPassword"
            type="password"
            placeholder="••••••••"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            disabled={isLoading}
            autoComplete="new-password"
            minLength={6}
          />
        </div>

        <Button type="submit" className="w-full" disabled={isLoading}>
          {isLoading ? 'Creating account...' : 'Sign Up'}
        </Button>
      </form>

      <div className="text-center text-sm">
        <span className="text-muted-foreground">Already have an account? </span>
        <Link href="/auth/signin" className="text-primary hover:underline">
          Sign in
        </Link>
      </div>
    </div>
  );
}
