'use client';

import { StatCard } from '@/components/ui/stat-card';
import { LoadingSkeleton } from '@/components/ui/loading-skeleton';
import type { PriceAggregate } from '@/lib/types';
import { cn } from '@/lib/utils';
import { 
  DollarSign, 
  TrendingUp, 
  TrendingDown, 
  BarChart3, 
  Layers,
  ShoppingCart 
} from 'lucide-react';

interface PricingSummaryProps {
  pricing: PriceAggregate | null;
  isLoading?: boolean;
  className?: string;
}

/**
 * Grid of StatCard components showing aggregate pricing metrics
 */
export function PricingSummary({
  pricing,
  isLoading = false,
  className,
}: PricingSummaryProps) {
  if (isLoading) {
    return (
      <div className={cn('grid gap-4', className || 'grid-cols-2 md:grid-cols-3 lg:grid-cols-6')}>
        {Array.from({ length: 6 }).map((_, i) => (
          <LoadingSkeleton key={i} variant="stat-card" />
        ))}
      </div>
    );
  }

  if (!pricing || pricing.listingCount === 0) {
    return null;
  }

  return (
    <div className={cn('grid gap-4', className || 'grid-cols-2 md:grid-cols-3 lg:grid-cols-6')}>
      <StatCard
        label="Average Price"
        value={pricing.avgPrice}
        isPrice
        icon={DollarSign}
        variant="compact"
      />
      <StatCard
        label="Median Price"
        value={pricing.medianPrice ?? 0}
        isPrice
        icon={BarChart3}
        variant="compact"
      />
      <StatCard
        label="Min Price"
        value={pricing.minPrice ?? 0}
        isPrice
        icon={TrendingDown}
        variant="compact"
      />
      <StatCard
        label="Max Price"
        value={pricing.maxPrice ?? 0}
        isPrice
        icon={TrendingUp}
        variant="compact"
      />
      <StatCard
        label="Price/Piece"
        value={pricing.avgPricePerPiece}
        isPrice
        currency="$"
        valueFormatter={(v) => `$${Number(v).toFixed(3)}`}
        icon={Layers}
        variant="compact"
      />
      <StatCard
        label="Active Listings"
        value={pricing.listingCount}
        icon={ShoppingCart}
        variant="compact"
      />
    </div>
  );
}

/**
 * Placeholder version of PricingSummary for unauthenticated users
 */
export function PricingSummaryPlaceholder({ className }: { className?: string }) {
  const placeholderValues = [
    { label: 'Average Price', value: 299.99 },
    { label: 'Median Price', value: 275.00 },
    { label: 'Min Price', value: 199.99 },
    { label: 'Max Price', value: 449.99 },
    { label: 'Price/Piece', value: 0.085 },
    { label: 'Active Listings', value: 42 },
  ];

  return (
    <div className={cn('grid gap-4', className || 'grid-cols-2 md:grid-cols-3 lg:grid-cols-6')}>
      {placeholderValues.map((item, i) => (
        <StatCard
          key={i}
          label={item.label}
          value={item.value}
          isPrice={i < 5}
          variant="compact"
        />
      ))}
    </div>
  );
}
