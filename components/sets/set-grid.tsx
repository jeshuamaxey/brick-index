'use client';

import { SetCard } from './set-card';
import { EmptyState } from '@/components/ui/empty-state';
import { LoadingSkeleton } from '@/components/ui/loading-skeleton';
import type { PublishedSetWithPricing } from '@/lib/types';
import { Inbox } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SetGridProps {
  sets: PublishedSetWithPricing[];
  isAuthenticated: boolean;
  isLoading?: boolean;
  className?: string;
}

/**
 * Responsive grid of SetCard components
 */
export function SetGrid({
  sets,
  isAuthenticated,
  isLoading = false,
  className,
}: SetGridProps) {
  if (isLoading) {
    return (
      <div
        className={cn(
          'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6',
          className
        )}
      >
        {Array.from({ length: 8 }).map((_, i) => (
          <LoadingSkeleton key={i} variant="card" />
        ))}
      </div>
    );
  }

  if (sets.length === 0) {
    return (
      <EmptyState
        icon={Inbox}
        title="No sets available"
        description="Check back soon for LEGO Modular Building pricing data."
      />
    );
  }

  return (
    <div
      className={cn(
        'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6',
        className
      )}
    >
      {sets.map((set) => (
        <SetCard
          key={set.id}
          setNum={set.setNum}
          name={set.name}
          year={set.year}
          numParts={set.numParts}
          setImgUrl={set.setImgUrl}
          pricing={set.pricing}
          isAuthenticated={isAuthenticated}
        />
      ))}
    </div>
  );
}
