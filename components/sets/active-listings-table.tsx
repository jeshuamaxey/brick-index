'use client';

import { useState, useEffect } from 'react';
import { ExternalLink, Package, Store } from 'lucide-react';
import { cn } from '@/lib/utils';
import { LoadingSkeleton } from '@/components/ui/loading-skeleton';
import { EmptyState } from '@/components/ui/empty-state';

interface Listing {
  id: string;
  marketplace: string;
  title: string;
  price: number | null;
  currency: string;
  url: string;
  condition: string | null;
  lastSeenAt: string | null;
  nature: string;
}

interface ActiveListingsTableProps {
  setNum: string;
  className?: string;
}

/**
 * Table displaying active marketplace listings for a LEGO set
 */
export function ActiveListingsTable({ setNum, className }: ActiveListingsTableProps) {
  const [listings, setListings] = useState<Listing[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchListings = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const response = await fetch(`/api/sets/${setNum}/listings`);
        
        if (!response.ok) {
          if (response.status === 401) {
            // User not authenticated - this shouldn't happen if gated properly
            setError('Authentication required');
            return;
          }
          throw new Error('Failed to fetch listings');
        }

        const data = await response.json();
        setListings(data.listings || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setIsLoading(false);
      }
    };

    fetchListings();
  }, [setNum]);

  if (isLoading) {
    return (
      <div className={cn('space-y-4', className)}>
        <h2 className="text-xl font-semibold text-foreground">Active Listings</h2>
        <div className="rounded-lg border border-foreground/10 overflow-hidden">
          <div className="divide-y divide-foreground/5">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="p-4">
                <LoadingSkeleton variant="table-row" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={cn('space-y-4', className)}>
        <h2 className="text-xl font-semibold text-foreground">Active Listings</h2>
        <EmptyState
          variant="error"
          title="Failed to load listings"
          description={error}
        />
      </div>
    );
  }

  if (listings.length === 0) {
    return (
      <div className={cn('space-y-4', className)}>
        <h2 className="text-xl font-semibold text-foreground">Active Listings</h2>
        <EmptyState
          icon={Store}
          title="No active listings"
          description="We haven't found any active marketplace listings for this set yet."
        />
      </div>
    );
  }

  const formatPrice = (price: number | null, currency: string) => {
    if (price === null) return '—';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
    }).format(price);
  };

  const formatMarketplace = (marketplace: string) => {
    const marketplaceNames: Record<string, string> = {
      ebay: 'eBay',
      bricklink: 'BrickLink',
      amazon: 'Amazon',
    };
    return marketplaceNames[marketplace.toLowerCase()] || marketplace;
  };

  return (
    <div className={cn('space-y-4', className)}>
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-foreground">Active Listings</h2>
        <span className="text-sm text-muted-foreground">
          {listings.length} listing{listings.length !== 1 ? 's' : ''}
        </span>
      </div>

      <div className="rounded-lg border border-foreground/10 backdrop-blur-md bg-gradient-to-br from-card/80 via-card/60 to-card/40 overflow-hidden">
        <div className="max-h-[400px] overflow-y-auto overflow-x-auto">
          <table className="w-full">
            <thead className="sticky top-0 z-10">
              <tr className="border-b border-foreground/10 bg-muted/80 backdrop-blur-sm">
                <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3 w-28">
                  Marketplace
                </th>
                <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3">
                  Listing
                </th>
                <th className="text-right text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3 w-28">
                  Price
                </th>
                <th className="text-center text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3 w-20">
                  Link
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-foreground/5">
              {listings.map((listing) => (
                <tr
                  key={listing.id}
                  className="hover:bg-muted/10 transition-colors"
                >
                  <td className="px-4 py-3 w-28">
                    <div className="flex items-center gap-2">
                      <Store className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      <span className="text-sm font-medium">
                        {formatMarketplace(listing.marketplace)}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="max-w-md">
                      <p className="text-sm text-foreground truncate" title={listing.title}>
                        {listing.title}
                      </p>
                      {listing.condition && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {listing.condition}
                        </p>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right w-28">
                    <span className="text-sm font-mono tabular-nums font-medium text-foreground">
                      {formatPrice(listing.price, listing.currency)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center w-20">
                    <a
                      href={listing.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center p-2 rounded-md hover:bg-muted/20 transition-colors text-muted-foreground hover:text-foreground"
                      title="View listing"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </a>
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

/**
 * Placeholder version for unauthenticated users
 */
export function ActiveListingsTablePlaceholder({ className }: { className?: string }) {
  const placeholderListings = [
    { marketplace: 'eBay', title: 'LEGO Creator Expert Modular Building Set - New Sealed', price: 299.99 },
    { marketplace: 'eBay', title: 'Modular Building Complete with Instructions & Box', price: 325.00 },
    { marketplace: 'eBay', title: 'LEGO Set - Excellent Condition, All Pieces Included', price: 275.50 },
    { marketplace: 'eBay', title: 'Rare Retired Modular - Free Shipping', price: 349.99 },
  ];

  return (
    <div className={cn('space-y-4', className)}>
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-foreground">Active Listings</h2>
        <span className="text-sm text-muted-foreground">4 listings</span>
      </div>

      <div className="rounded-lg border border-foreground/10 backdrop-blur-md bg-gradient-to-br from-card/80 via-card/60 to-card/40 overflow-hidden">
        <div className="max-h-[400px] overflow-y-auto overflow-x-auto">
          <table className="w-full">
            <thead className="sticky top-0 z-10">
              <tr className="border-b border-foreground/10 bg-muted/80 backdrop-blur-sm">
                <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3 w-28">
                  Marketplace
                </th>
                <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3">
                  Listing
                </th>
                <th className="text-right text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3 w-28">
                  Price
                </th>
                <th className="text-center text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3 w-20">
                  Link
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-foreground/5">
              {placeholderListings.map((listing, i) => (
                <tr key={i} className="hover:bg-muted/10 transition-colors">
                  <td className="px-4 py-3 w-28">
                    <div className="flex items-center gap-2">
                      <Store className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      <span className="text-sm font-medium">{listing.marketplace}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-sm text-foreground truncate max-w-md">
                      {listing.title}
                    </p>
                  </td>
                  <td className="px-4 py-3 text-right w-28">
                    <span className="text-sm font-mono tabular-nums font-medium text-foreground">
                      ${listing.price.toFixed(2)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center w-20">
                    <span className="inline-flex items-center justify-center p-2 text-muted-foreground">
                      <ExternalLink className="h-4 w-4" />
                    </span>
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
