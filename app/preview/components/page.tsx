'use client';

import * as React from 'react';
import { PriceDisplay } from '@/components/ui/price-display';
import { StatCard } from '@/components/ui/stat-card';
import { StatusBadge } from '@/components/ui/status-badge';
import { FilterPanel } from '@/components/ui/filter-panel';
import { LoadingSkeleton } from '@/components/ui/loading-skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { DollarSign, TrendingUp, Package, Moon, Sun } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';


export default function ComponentsPreviewPage() {
  const [isDark, setIsDark] = React.useState(false);
  const [priceRange, setPriceRange] = React.useState({ min: 0, max: 500 });
  const [selectedStatuses, setSelectedStatuses] = React.useState<string[]>([]);
  const [selectedMarketplaces, setSelectedMarketplaces] = React.useState<string[]>([]);
  const [selectedConditions, setSelectedConditions] = React.useState<string[]>([]);

  React.useEffect(() => {
    // Check initial theme
    const html = document.documentElement;
    setIsDark(html.classList.contains('dark'));
  }, []);

  const toggleDarkMode = () => {
    const html = document.documentElement;
    if (html.classList.contains('dark')) {
      html.classList.remove('dark');
      setIsDark(false);
    } else {
      html.classList.add('dark');
      setIsDark(true);
    }
  };

  const activeFilterCount =
    (priceRange.min > 0 || priceRange.max < 1000 ? 1 : 0) +
    selectedStatuses.length +
    selectedMarketplaces.length +
    selectedConditions.length;

  return (
    <div className="min-h-screen bg-background">
      {/* Sticky Header */}
      <div className="sticky top-0 z-50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b border-brand/10">
        <div className="max-w-7xl mx-auto px-8 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold mb-2 text-foreground">Component Preview</h1>
              <p className="text-muted-foreground">
                Preview of the 8 essential components for the LEGO pricing platform
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={toggleDarkMode}
                className="flex items-center gap-2 text-foreground"
              >
                {isDark ? (
                  <>
                    <Sun className="h-4 w-4" />
                    Light Mode
                  </>
                ) : (
                  <>
                    <Moon className="h-4 w-4" />
                    Dark Mode
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto p-8 space-y-12">

        {/* 1. Price Display Component */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-foreground">1. Price Display Component</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Default</p>
              <PriceDisplay value={125.50} currency="$" />
            </div>
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Large</p>
              <PriceDisplay value={125.50} currency="$" variant="large" />
            </div>
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Compact</p>
              <PriceDisplay value={125.50} currency="$" variant="compact" />
            </div>
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">With Positive Change</p>
              <PriceDisplay
                value={125.50}
                currency="$"
                showChange
                changePercentage={5.2}
              />
            </div>
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">With Negative Change</p>
              <PriceDisplay
                value={125.50}
                currency="$"
                showChange
                changePercentage={-3.8}
              />
            </div>
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Euro Currency</p>
              <PriceDisplay value={89.99} currency="€" />
            </div>
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">With Time Period</p>
              <PriceDisplay
                value={125.50}
                currency="$"
                showChange
                changePercentage={5.2}
                timePeriod="7d"
              />
            </div>
          </div>
        </section>

        <Separator />

        {/* 2. Stat Card Component */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-foreground">2. Stat Card Component</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <StatCard
              label="Average Price"
              value={125.50}
              isPrice
              currency="$"
              icon={DollarSign}
            />
            <StatCard
              label="Total Listings"
              value={1247}
              icon={Package}
            />
            <StatCard
              label="Price Trend"
              value={125.50}
              isPrice
              currency="$"
              showTrend
              trendPercentage={5.2}
              timePeriod="7d"
              icon={TrendingUp}
            />
            <StatCard
              label="Compact Version"
              value={89.99}
              isPrice
              currency="$"
              variant="compact"
            />
            <StatCard
              label="With Negative Trend"
              value={125.50}
              isPrice
              currency="$"
              showTrend
              trendPercentage={-3.8}
              timePeriod="30d"
            />
            <StatCard
              label="String Value"
              value="1,247"
            />
          </div>
        </section>

        <Separator />

        {/* 3. Status Badge Component */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-foreground">3. Status Badge Component</h2>
          <div className="flex flex-wrap gap-3">
            <StatusBadge status="active" />
            <StatusBadge status="sold" />
            <StatusBadge status="expired" />
            <StatusBadge status="removed" />
            <StatusBadge status="running" />
            <StatusBadge status="completed" />
            <StatusBadge status="failed" />
          </div>
        </section>

        <Separator />

        {/* 4. Filter Panel Component */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-foreground">4. Filter Panel Component</h2>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-1">
              <FilterPanel
                priceRange={priceRange}
                onPriceRangeChange={setPriceRange}
                selectedStatuses={selectedStatuses}
                onStatusChange={setSelectedStatuses}
                selectedMarketplaces={selectedMarketplaces}
                onMarketplaceChange={setSelectedMarketplaces}
                selectedConditions={selectedConditions}
                onConditionChange={setSelectedConditions}
                activeFilterCount={activeFilterCount}
                onClearFilters={() => {
                  setPriceRange({ min: 0, max: 500 });
                  setSelectedStatuses([]);
                  setSelectedMarketplaces([]);
                  setSelectedConditions([]);
                }}
                variant="sidebar"
              />
            </div>
            <div className="lg:col-span-2">
              <div className="rounded-lg border border-foreground/10 backdrop-blur-md bg-gradient-to-br from-card/80 via-card/60 to-card/40 shadow-lg p-6">
                <p className="text-sm text-muted-foreground">
                  Filter panel is displayed on the left. Try adjusting the filters to see the
                  active filter count update.
                </p>
                <div className="mt-4 space-y-2">
                  <p className="text-sm font-medium text-foreground">Active Filters:</p>
                  <div className="flex flex-wrap gap-2">
                    {(priceRange.min > 0 || priceRange.max < 1000) && (
                      <span className="px-2 py-1 rounded bg-muted text-xs text-foreground">
                        Price: ${priceRange.min > 0 ? priceRange.min : '0'} - ${priceRange.max < 1000 ? priceRange.max : '1000+'}
                      </span>
                    )}
                    {selectedStatuses.length > 0 && (
                      <span className="px-2 py-1 rounded bg-muted text-xs text-foreground">
                        Status: {selectedStatuses.join(', ')}
                      </span>
                    )}
                    {selectedMarketplaces.length > 0 && (
                      <span className="px-2 py-1 rounded bg-muted text-xs text-foreground">
                        Marketplace: {selectedMarketplaces.join(', ')}
                      </span>
                    )}
                    {selectedConditions.length > 0 && (
                      <span className="px-2 py-1 rounded bg-muted text-xs text-foreground">
                        Condition: {selectedConditions.join(', ')}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <Separator />

        {/* 5. Loading Skeleton Component */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-foreground">5. Loading Skeleton Component</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Card Skeleton</p>
              <LoadingSkeleton variant="card" />
            </div>
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Stat Card Skeleton</p>
              <LoadingSkeleton variant="stat-card" />
            </div>
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">List Item Skeleton</p>
              <LoadingSkeleton variant="list-item" />
            </div>
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Table Row Skeleton</p>
              <div className="border rounded-lg p-2">
                <LoadingSkeleton variant="table-row" />
              </div>
            </div>
          </div>
        </section>

        <Separator />

        {/* 6. Empty State Component */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-foreground">6. Empty State Component</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-lg border border-foreground/10 backdrop-blur-md bg-gradient-to-br from-card/80 via-card/60 to-card/40 shadow-lg">
              <EmptyState
                title="No listings found"
                description="Try adjusting your filters to see more results."
                action={{
                  label: 'Clear Filters',
                  onClick: () => console.log('Clear filters clicked'),
                }}
              />
            </div>
            <div className="rounded-lg border border-foreground/10 backdrop-blur-md bg-gradient-to-br from-card/80 via-card/60 to-card/40 shadow-lg">
              <EmptyState
                title="No search results"
                description="We couldn't find any LEGO sets matching your search."
                icon={Package}
                action={{
                  label: 'Browse All',
                  onClick: () => console.log('Browse all clicked'),
                }}
              />
            </div>
            <div className="rounded-lg border border-foreground/10 backdrop-blur-md bg-gradient-to-br from-card/80 via-card/60 to-card/40 shadow-lg">
              <EmptyState
                title="Error loading data"
                description="Something went wrong while loading the listings. Please try again."
                variant="error"
                action={{
                  label: 'Retry',
                  onClick: () => console.log('Retry clicked'),
                }}
              />
            </div>
            <div className="rounded-lg border border-foreground/10 backdrop-blur-md bg-gradient-to-br from-card/80 via-card/60 to-card/40 shadow-lg">
              <EmptyState
                title="Empty collection"
                description="You haven't added any LEGO sets to your collection yet."
              />
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
