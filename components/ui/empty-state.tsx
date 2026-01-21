'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { Button } from './button';
import { LucideIcon, Search, Inbox, AlertCircle } from 'lucide-react';

export interface EmptyStateProps extends React.HTMLAttributes<HTMLDivElement> {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  variant?: 'default' | 'error';
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  variant = 'default',
  className,
  ...props
}: EmptyStateProps) {
  const DefaultIcon = variant === 'error' ? AlertCircle : Icon || Search;

  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center py-12 px-4 text-center',
        className
      )}
      {...props}
    >
      <div
        className={cn(
          'p-3 mb-4 rounded-lg backdrop-blur-sm border',
          variant === 'error'
            ? 'bg-destructive/10 text-destructive border-destructive/20'
            : 'bg-brand/10 text-brand border-brand/20'
        )}
      >
        <DefaultIcon className="h-6 w-6" />
      </div>
      <h3
        className={cn(
          'text-lg font-semibold mb-2 text-foreground',
          variant === 'error' && 'text-destructive'
        )}
      >
        {title}
      </h3>
      {description && (
        <p className="text-sm text-foreground/70 max-w-md mb-6">{description}</p>
      )}
      {action && (
        <Button 
          onClick={action.onClick} 
          variant="outline"
          className={cn(
            variant === 'error' 
              ? 'border-destructive/30 text-destructive hover:bg-destructive/10 hover:border-destructive/50'
              : 'border-brand/30 text-brand hover:bg-brand/10 hover:border-brand/50'
          )}
        >
          {action.label}
        </Button>
      )}
    </div>
  );
}
