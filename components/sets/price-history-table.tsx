'use client';

import { useState, useEffect } from 'react';
import { PriceDisplay } from '@/components/ui/price-display';
import { LoadingSkeleton } from '@/components/ui/loading-skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { Button } from '@/components/ui/button';
import type { PriceHistoryPoint } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Calendar, RefreshCw, Search } from 'lucide-react';

interface PriceHistoryTableProps {
  setNum: string;
  className?: string;
}

/**
 * Tabular display of historical price data
 */
export function PriceHistoryTable({ setNum, className }: PriceHistoryTableProps) {
  const [history, setHistory] = useState<PriceHistoryPoint[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [aggregation, setAggregation] = useState<'daily' | 'weekly'>('weekly');

  const fetchHistory = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const days = aggregation === 'weekly' ? 90 : 30;
      const response = await fetch(
        `/api/sets/${setNum}/price-history?days=${days}&aggregation=${aggregation}`
      );

      if (!response.ok) {
        if (response.status === 401) {
          setError('Authentication required');
          return;
        }
        throw new Error('Failed to fetch price history');
      }

      const data = await response.json();
      setHistory(data.history || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, [setNum, aggregation]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: aggregation === 'weekly' ? '2-digit' : undefined,
    });
  };

  if (error) {
    return (
      <EmptyState
        variant="error"
        title="Unable to load price history"
        description={error}
        action={{
          label: 'Retry',
          onClick: fetchHistory,
        }}
      />
    );
  }

  return (
    <div className={cn('space-y-4', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Calendar className="h-5 w-5 text-muted-foreground" />
          <h3 className="text-lg font-semibold text-foreground">Price History</h3>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-md border border-foreground/10 overflow-hidden">
            <button
              onClick={() => setAggregation('daily')}
              className={cn(
                'px-3 py-1.5 text-sm transition-colors',
                aggregation === 'daily'
                  ? 'bg-brand/10 text-brand'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              Daily
            </button>
            <button
              onClick={() => setAggregation('weekly')}
              className={cn(
                'px-3 py-1.5 text-sm transition-colors',
                aggregation === 'weekly'
                  ? 'bg-brand/10 text-brand'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              Weekly
            </button>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={fetchHistory}
            disabled={isLoading}
          >
            <RefreshCw className={cn('h-4 w-4', isLoading && 'animate-spin')} />
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-lg border border-foreground/10 backdrop-blur-md bg-gradient-to-br from-card/80 via-card/60 to-card/40 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-4 space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <LoadingSkeleton key={i} variant="table-row" />
            ))}
          </div>
        ) : history.length === 0 ? (
          <div className="p-8">
            <EmptyState
              icon={Search}
              title="No price history"
              description="We're still collecting pricing data for this set."
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-foreground/10 bg-muted/20">
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    {aggregation === 'weekly' ? 'Week Of' : 'Date'}
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Avg Price
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Min
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Max
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Listings
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-foreground/5">
                {history.map((point, index) => (
                  <tr
                    key={point.date}
                    className={cn(
                      'transition-colors hover:bg-muted/10',
                      index === 0 && 'bg-brand/5'
                    )}
                  >
                    <td className="px-4 py-3 text-sm text-foreground text-left">
                      {formatDate(point.date)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end">
                        <PriceDisplay value={point.avgPrice} variant="compact" />
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end">
                        {point.minPrice !== null ? (
                          <PriceDisplay value={point.minPrice} variant="compact" />
                        ) : (
                          <span className="text-sm text-muted-foreground">-</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end">
                        {point.maxPrice !== null ? (
                          <PriceDisplay value={point.maxPrice} variant="compact" />
                        ) : (
                          <span className="text-sm text-muted-foreground">-</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums text-sm text-foreground">
                      {point.listingCount}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Placeholder version of PriceHistoryTable for unauthenticated users
 */
export function PriceHistoryTablePlaceholder({ className }: { className?: string }) {
  const placeholderData = [
    { date: 'Jan 15', avgPrice: 299.99, minPrice: 249.99, maxPrice: 349.99, listingCount: 12 },
    { date: 'Jan 8', avgPrice: 305.00, minPrice: 259.99, maxPrice: 359.99, listingCount: 8 },
    { date: 'Jan 1', avgPrice: 289.99, minPrice: 239.99, maxPrice: 339.99, listingCount: 15 },
    { date: 'Dec 25', avgPrice: 315.00, minPrice: 269.99, maxPrice: 379.99, listingCount: 6 },
    { date: 'Dec 18', avgPrice: 295.50, minPrice: 249.99, maxPrice: 345.99, listingCount: 10 },
  ];

  return (
    <div className={cn('space-y-4', className)}>
      <div className="flex items-center gap-2">
        <Calendar className="h-5 w-5 text-muted-foreground" />
        <h3 className="text-lg font-semibold text-foreground">Price History</h3>
      </div>

      <div className="rounded-lg border border-foreground/10 backdrop-blur-md bg-gradient-to-br from-card/80 via-card/60 to-card/40 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-foreground/10 bg-muted/20">
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Week Of
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Avg Price
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Min
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Max
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Listings
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-foreground/5">
              {placeholderData.map((point, index) => (
                <tr key={index}>
                  <td className="px-4 py-3 text-sm text-foreground text-left">{point.date}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end">
                      <span className="font-mono tabular-nums text-sm">${point.avgPrice.toFixed(2)}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end">
                      <span className="font-mono tabular-nums text-sm">${point.minPrice.toFixed(2)}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end">
                      <span className="font-mono tabular-nums text-sm">${point.maxPrice.toFixed(2)}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums text-sm text-foreground">
                    {point.listingCount}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
