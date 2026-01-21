'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { cva, type VariantProps } from 'class-variance-authority';

const statusBadgeVariants = cva(
  'inline-flex items-center rounded-md backdrop-blur-sm bg-background/40 px-2.5 py-0.5 text-xs font-medium border',
  {
    variants: {
      status: {
        active: 'bg-green-500/20 text-green-700 dark:text-green-400 border-green-500/30',
        sold: 'bg-blue-500/20 text-blue-700 dark:text-blue-400 border-blue-500/30',
        expired: 'bg-gray-500/20 text-gray-700 dark:text-gray-400 border-gray-500/30',
        removed: 'bg-red-500/20 text-red-700 dark:text-red-400 border-red-500/30',
        running: 'bg-yellow-500/20 text-yellow-700 dark:text-yellow-400 border-yellow-500/30',
        completed: 'bg-green-500/20 text-green-700 dark:text-green-400 border-green-500/30',
        failed: 'bg-red-500/20 text-red-700 dark:text-red-400 border-red-500/30',
      },
    },
    defaultVariants: {
      status: 'active',
    },
  }
);

export interface StatusBadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof statusBadgeVariants> {
  status: 'active' | 'sold' | 'expired' | 'removed' | 'running' | 'completed' | 'failed';
  children?: React.ReactNode;
}

export function StatusBadge({
  status,
  children,
  className,
  ...props
}: StatusBadgeProps) {
  const displayText = children || status.charAt(0).toUpperCase() + status.slice(1);

  return (
    <span
      className={cn(statusBadgeVariants({ status }), className)}
      {...props}
    >
      {displayText}
    </span>
  );
}
