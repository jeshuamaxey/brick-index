'use client';

import { type ReactNode } from 'react';
import { SignUpCTA } from './sign-up-cta';
import { cn } from '@/lib/utils';

interface PricingGateProps {
  isAuthenticated: boolean;
  children: ReactNode;
  className?: string;
  ctaTitle?: string;
  ctaDescription?: string;
  /**
   * Content to show as a blurred placeholder when not authenticated
   * If not provided, children will be blurred
   */
  placeholder?: ReactNode;
}

/**
 * Wrapper component that gates pricing content behind authentication
 * Shows a sign-up CTA overlay when user is not authenticated
 */
export function PricingGate({
  isAuthenticated,
  children,
  className,
  ctaTitle,
  ctaDescription,
  placeholder,
}: PricingGateProps) {
  if (isAuthenticated) {
    return <>{children}</>;
  }

  return (
    <div className={cn('relative', className)}>
      {/* Blurred content */}
      <div className="select-none pointer-events-none blur-sm opacity-50">
        {placeholder || children}
      </div>
      
      {/* Sign-up CTA overlay */}
      <SignUpCTA title={ctaTitle} description={ctaDescription} />
    </div>
  );
}
