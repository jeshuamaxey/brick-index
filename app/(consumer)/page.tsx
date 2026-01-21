'use client';

import { useState, useEffect } from 'react';
import { SetGrid } from '@/components/sets';
import { useAuth } from './components/auth-context';
import { Button } from '@/components/ui/button';
import { Blocks, TrendingUp, ShoppingCart, BarChart3 } from 'lucide-react';
import Link from 'next/link';
import type { PublishedSetWithPricing } from '@/lib/types';

export default function ConsumerHomePage() {
  const { isAuthenticated } = useAuth();
  const [sets, setSets] = useState<PublishedSetWithPricing[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchSets = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        const response = await fetch('/api/sets');
        if (!response.ok) {
          throw new Error('Failed to fetch sets');
        }
        
        const data = await response.json();
        setSets(data.sets || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setIsLoading(false);
      }
    };

    fetchSets();
  }, []);

  return (
    <div className="space-y-12">
      {/* Hero Section */}
      <section className="text-center space-y-6 py-8">
        <div className="inline-flex items-center justify-center p-3 rounded-xl bg-brand/10 border border-brand/20 mb-4">
          <Blocks className="h-8 w-8 text-brand" />
        </div>
        <h1 className="text-4xl md:text-5xl font-bold text-foreground leading-tight">
          LEGO Modular Building
          <br />
          <span className="text-brand">Price Tracker</span>
        </h1>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
          Track real-time marketplace prices for LEGO Modular Buildings. 
          Compare prices, view trends, and find the best deals on your favorite sets.
        </p>

        {/* Sign-up CTA for unauthenticated users */}
        {!isAuthenticated && (
          <div className="flex items-center justify-center gap-4 pt-4">
            <Link href="/auth/signup">
              <Button size="lg" className="bg-brand text-brand-foreground hover:bg-brand/90">
                Sign Up Free
              </Button>
            </Link>
            <Link href="/auth/signin">
              <Button size="lg" variant="outline" className="border-foreground/20">
                Sign In
              </Button>
            </Link>
          </div>
        )}
      </section>

      {/* Features Section (for unauthenticated users) */}
      {!isAuthenticated && (
        <section className="grid grid-cols-1 md:grid-cols-3 gap-6 py-8">
          <FeatureCard
            icon={TrendingUp}
            title="Price Trends"
            description="Track how prices change over time with historical data and trend analysis."
          />
          <FeatureCard
            icon={ShoppingCart}
            title="Live Listings"
            description="See real-time data from marketplace listings to find the best deals."
          />
          <FeatureCard
            icon={BarChart3}
            title="Market Insights"
            description="Get average, median, and range pricing data for informed decisions."
          />
        </section>
      )}

      {/* Sign-up Banner for unauthenticated users */}
      {!isAuthenticated && (
        <section className="rounded-lg border border-brand/20 bg-brand/5 p-6 text-center">
          <p className="text-lg font-medium text-foreground mb-2">
            Create a free account to unlock pricing data
          </p>
          <p className="text-sm text-muted-foreground mb-4">
            Sign up to view average prices, price trends, and listing counts for all sets.
          </p>
          <Link href="/auth/signup">
            <Button className="bg-brand text-brand-foreground hover:bg-brand/90">
              Get Started Free
            </Button>
          </Link>
        </section>
      )}

      {/* Sets Grid Section */}
      <section className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-semibold text-foreground">
            LEGO Modular Buildings
          </h2>
          <p className="text-sm text-muted-foreground">
            {sets.length} sets
          </p>
        </div>

        {error ? (
          <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-6 text-center">
            <p className="text-destructive font-medium">Error loading sets</p>
            <p className="text-sm text-muted-foreground mt-1">{error}</p>
            <Button
              variant="outline"
              size="sm"
              className="mt-4 border-destructive/30 text-destructive hover:bg-destructive/10"
              onClick={() => window.location.reload()}
            >
              Retry
            </Button>
          </div>
        ) : (
          <SetGrid
            sets={sets}
            isAuthenticated={isAuthenticated}
            isLoading={isLoading}
          />
        )}
      </section>
    </div>
  );
}

function FeatureCard({
  icon: Icon,
  title,
  description,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-lg border border-foreground/10 backdrop-blur-md bg-gradient-to-br from-card/80 via-card/60 to-card/40 shadow-sm p-6 text-center">
      <div className="inline-flex items-center justify-center p-2 rounded-lg bg-brand/10 border border-brand/20 mb-4">
        <Icon className="h-5 w-5 text-brand" />
      </div>
      <h3 className="font-semibold text-foreground mb-2">{title}</h3>
      <p className="text-sm text-muted-foreground">{description}</p>
    </div>
  );
}
