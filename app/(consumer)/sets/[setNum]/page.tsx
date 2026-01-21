'use client';

import { useState, useEffect, use } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useAuth } from '../../components/auth-context';
import { 
  PricingSummary, 
  PricingSummaryPlaceholder,
  PriceHistoryTable,
  PriceHistoryTablePlaceholder,
  ActiveListingsTable,
  ActiveListingsTablePlaceholder,
  PricingGate 
} from '@/components/sets';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { LoadingSkeleton } from '@/components/ui/loading-skeleton';
import type { PriceAggregate } from '@/lib/types';
import { ArrowLeft, ExternalLink, Package, Search } from 'lucide-react';

interface SetData {
  id: string;
  setNum: string;
  name: string;
  year: number | null;
  themeId: number | null;
  themeName: string | null;
  numParts: number | null;
  setImgUrl: string | null;
  setUrl: string | null;
}

interface PageProps {
  params: Promise<{ setNum: string }>;
}

export default function SetDetailPage({ params }: PageProps) {
  const { setNum } = use(params);
  const { isAuthenticated } = useAuth();
  const [set, setSet] = useState<SetData | null>(null);
  const [pricing, setPricing] = useState<PriceAggregate | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchSetDetails = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const response = await fetch(`/api/sets/${setNum}`);
        
        if (!response.ok) {
          if (response.status === 404) {
            setError('Set not found');
            return;
          }
          throw new Error('Failed to fetch set details');
        }

        const data = await response.json();
        setSet(data.set);
        setPricing(data.pricing);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setIsLoading(false);
      }
    };

    fetchSetDetails();
  }, [setNum]);

  if (isLoading) {
    return (
      <div className="space-y-10">
        <div className="h-5 w-32 bg-muted/30 rounded animate-pulse" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <LoadingSkeleton variant="card" className="aspect-square" />
          <div className="space-y-8">
            <div className="space-y-4">
              <div className="h-6 w-20 bg-muted/30 rounded animate-pulse" />
              <div className="h-10 w-3/4 bg-muted/30 rounded animate-pulse" />
              <div className="flex gap-4">
                <div className="h-5 w-24 bg-muted/30 rounded animate-pulse" />
                <div className="h-5 w-24 bg-muted/30 rounded animate-pulse" />
              </div>
            </div>
            <div className="space-y-4">
              <div className="h-6 w-28 bg-muted/30 rounded animate-pulse" />
              <div className="grid grid-cols-2 xl:grid-cols-3 gap-4">
                {Array.from({ length: 6 }).map((_, i) => (
                  <LoadingSkeleton key={i} variant="stat-card" />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !set) {
    return (
      <EmptyState
        variant="error"
        title={error === 'Set not found' ? 'Set not found' : 'Error loading set'}
        description={
          error === 'Set not found'
            ? 'This set may not be available or may have been removed.'
            : 'Please try again later.'
        }
        action={{
          label: 'Back to all sets',
          onClick: () => window.location.href = '/',
        }}
      />
    );
  }

  const hasPricing = pricing && pricing.listingCount > 0;

  return (
    <div className="space-y-10">
      {/* Back Link */}
      <Link
        href="/"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to all sets
      </Link>

      {/* Two-column header: Image left, Info + Pricing right */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
        {/* Left: Image */}
        <div className="relative aspect-square rounded-lg border border-foreground/10 backdrop-blur-md bg-gradient-to-br from-card/80 via-card/60 to-card/40 shadow-sm overflow-hidden">
          {set.setImgUrl ? (
            <Image
              src={set.setImgUrl}
              alt={set.name}
              fill
              className="object-contain p-8"
              sizes="(max-width: 1024px) 100vw, 50vw"
              priority
            />
          ) : (
            <div className="flex items-center justify-center h-full">
              <Package className="h-24 w-24 text-muted-foreground/30" />
            </div>
          )}
        </div>

        {/* Right: Info + Pricing Cards */}
        <div className="space-y-8">
          {/* Set Info */}
          <div className="space-y-4">
            {/* Set Number Badge */}
            <div className="inline-flex items-center px-3 py-1 rounded-md backdrop-blur-sm bg-brand/10 border border-brand/20">
              <span className="text-sm font-mono tabular-nums text-brand font-medium">
                {set.setNum}
              </span>
            </div>

            {/* Name */}
            <h1 className="text-3xl md:text-4xl font-bold text-foreground leading-tight">
              {set.name}
            </h1>

            {/* Metadata */}
            <div className="flex flex-wrap items-center gap-4 text-muted-foreground">
              {set.year && (
                <div className="flex items-center gap-2">
                  <span className="text-sm">Released</span>
                  <span className="font-mono tabular-nums font-medium text-foreground">
                    {set.year}
                  </span>
                </div>
              )}
              {set.numParts && (
                <div className="flex items-center gap-2">
                  <span className="text-sm">Pieces</span>
                  <span className="font-mono tabular-nums font-medium text-foreground">
                    {set.numParts.toLocaleString()}
                  </span>
                </div>
              )}
              {set.themeName && (
                <div className="flex items-center gap-2">
                  <span className="text-sm">Theme</span>
                  <span className="font-medium text-foreground">{set.themeName}</span>
                </div>
              )}
            </div>

            {/* External Link */}
            {set.setUrl && (
              <div className="pt-2">
                <a href={set.setUrl} target="_blank" rel="noopener noreferrer">
                  <Button variant="outline" size="sm" className="border-foreground/20">
                    <ExternalLink className="h-4 w-4 mr-2" />
                    View on Rebrickable
                  </Button>
                </a>
              </div>
            )}
          </div>

          {/* Pricing Cards */}
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-foreground">Pricing Data</h2>

            {isAuthenticated ? (
              hasPricing ? (
                <PricingSummary 
                  pricing={pricing} 
                  className="grid-cols-2 md:grid-cols-3 lg:grid-cols-2 xl:grid-cols-3"
                />
              ) : (
                <EmptyState
                  icon={Search}
                  title="No pricing data yet"
                  description="We're actively monitoring marketplaces for listings of this set. Check back soon!"
                />
              )
            ) : (
              <PricingGate
                isAuthenticated={isAuthenticated}
                ctaTitle="Sign up to see pricing"
                ctaDescription="Create a free account to unlock average prices, price ranges, and market insights for this set."
                placeholder={
                  <PricingSummaryPlaceholder 
                    className="grid-cols-2 md:grid-cols-3 lg:grid-cols-2 xl:grid-cols-3" 
                  />
                }
              >
                <PricingSummary pricing={pricing} />
              </PricingGate>
            )}
          </div>
        </div>
      </div>

      {/* Price History Section - Full width below */}
      <section className="space-y-6">
        {isAuthenticated ? (
          hasPricing ? (
            <PriceHistoryTable setNum={set.setNum} />
          ) : null
        ) : (
          <PricingGate
            isAuthenticated={isAuthenticated}
            ctaTitle="Sign up for price history"
            ctaDescription="Create a free account to see how prices have changed over time."
            placeholder={<PriceHistoryTablePlaceholder />}
          >
            <PriceHistoryTable setNum={set.setNum} />
          </PricingGate>
        )}
      </section>

      {/* Active Listings Section - Full width below */}
      <section>
        {isAuthenticated ? (
          <ActiveListingsTable setNum={set.setNum} />
        ) : (
          <PricingGate
            isAuthenticated={isAuthenticated}
            ctaTitle="Sign up to view listings"
            ctaDescription="Create a free account to see all active marketplace listings for this set."
            placeholder={<ActiveListingsTablePlaceholder />}
          >
            <ActiveListingsTable setNum={set.setNum} />
          </PricingGate>
        )}
      </section>
    </div>
  );
}
