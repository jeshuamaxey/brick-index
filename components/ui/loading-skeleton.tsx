'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { Skeleton } from './skeleton';
import { cva, type VariantProps } from 'class-variance-authority';

const loadingSkeletonVariants = cva('', {
  variants: {
    variant: {
      card: 'flex flex-col',
      'table-row': 'flex items-center',
      'list-item': 'flex items-center gap-4',
      'stat-card': 'flex flex-col',
    },
  },
  defaultVariants: {
    variant: 'card',
  },
});

export interface LoadingSkeletonProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof loadingSkeletonVariants> {
  variant?: 'card' | 'table-row' | 'list-item' | 'stat-card';
}

export function LoadingSkeleton({
  variant,
  className,
  ...props
}: LoadingSkeletonProps) {
  const cardBaseClasses = 'rounded-lg border border-foreground/10 backdrop-blur-md bg-gradient-to-br from-card/80 via-card/60 to-card/40 shadow-lg';

  if (variant === 'card') {
    return (
      <div className={cn(cardBaseClasses, 'p-6', className)} {...props}>
        <Skeleton className="h-4 w-3/4 mb-4" />
        <Skeleton className="h-4 w-1/2 mb-2" />
        <Skeleton className="h-4 w-2/3" />
        <div className="mt-4 flex gap-2">
          <Skeleton className="h-6 w-16 rounded-full" />
          <Skeleton className="h-6 w-20 rounded-full" />
        </div>
      </div>
    );
  }

  if (variant === 'table-row') {
    return (
      <div className={cn('flex items-center gap-4 py-3', className)} {...props}>
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 w-16 rounded-full" />
      </div>
    );
  }

  if (variant === 'list-item') {
    return (
      <div className={cn('flex items-center gap-4 p-4 border border-foreground/10 rounded-md backdrop-blur-sm bg-background/40', className)} {...props}>
        <Skeleton className="h-16 w-16 rounded-lg shrink-0" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-3 w-1/2" />
        </div>
        <Skeleton className="h-8 w-20" />
      </div>
    );
  }

  if (variant === 'stat-card') {
    return (
      <div className={cn(cardBaseClasses, 'p-6', className)} {...props}>
        <Skeleton className="h-4 w-24 mb-4" />
        <Skeleton className="h-8 w-32 mb-2" />
        <Skeleton className="h-3 w-20" />
      </div>
    );
  }

  return <Skeleton className={className} {...props} />;
}
