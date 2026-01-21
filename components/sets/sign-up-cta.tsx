'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Lock } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SignUpCTAProps {
  title?: string;
  description?: string;
  className?: string;
}

/**
 * Call-to-action overlay for unauthenticated users
 * Shows blurred overlay with sign-up/sign-in buttons
 */
export function SignUpCTA({
  title = 'Sign up to unlock pricing data',
  description = 'Create a free account to view real-time pricing insights for LEGO sets.',
  className,
}: SignUpCTAProps) {
  const pathname = usePathname();
  const returnUrl = encodeURIComponent(pathname);

  return (
    <div
      className={cn(
        'absolute inset-0 flex flex-col items-center justify-center z-10',
        'backdrop-blur-md bg-background/60',
        'rounded-lg',
        className
      )}
    >
      <div className="flex flex-col items-center text-center p-6 max-w-sm">
        <div className="p-3 mb-4 rounded-lg backdrop-blur-sm border bg-brand/10 text-brand border-brand/20">
          <Lock className="h-6 w-6" />
        </div>
        <h3 className="text-lg font-semibold mb-2 text-foreground">{title}</h3>
        <p className="text-sm text-foreground/70 mb-6">{description}</p>
        <div className="flex gap-3">
          <Link href={`/auth/signin?returnUrl=${returnUrl}`}>
            <Button 
              variant="outline" 
              className="border-brand/30 text-brand hover:bg-brand/10 hover:border-brand/50"
            >
              Sign In
            </Button>
          </Link>
          <Link href={`/auth/signup?returnUrl=${returnUrl}`}>
            <Button className="bg-brand text-brand-foreground hover:bg-brand/90">
              Sign Up Free
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
