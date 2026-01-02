// Backend page to view aggregated market statistics

'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Bar, BarChart, CartesianGrid, XAxis, YAxis, LabelList } from 'recharts';
import { TrendingUp } from 'lucide-react';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';

interface AggregateData {
  basic: {
    totalListings: number;
    withAnalysis: number;
    withoutAnalysis: number;
    withPricePerPiece: number;
    withoutPricePerPiece: number;
  };
  priceDistribution: {
    bins: Array<{
      range: string;
      count: number;
    }>;
    minPrice: number;
    maxPrice: number;
  };
}

interface PipelineStats {
  rawListings: number;
  listings: number;
  enrichedListings: number;
  analyzedListings: number;
}

export default function ResourcesPage() {
  const [data, setData] = useState<AggregateData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [numberOfBuckets, setNumberOfBuckets] = useState<number>(5);
  const [pipelineStats, setPipelineStats] = useState<PipelineStats | null>(null);
  const [pipelineStatsLoading, setPipelineStatsLoading] = useState(true);

  useEffect(() => {
    fetchData();
    fetchPipelineStats();
  }, [numberOfBuckets]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/dev/aggregate?numberOfBuckets=${numberOfBuckets}`);
      if (!response.ok) {
        throw new Error('Failed to fetch aggregate data');
      }
      const result = await response.json();
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const fetchPipelineStats = async () => {
    try {
      setPipelineStatsLoading(true);
      const response = await fetch('/api/backend/resources/pipeline-stats');
      if (!response.ok) {
        throw new Error('Failed to fetch pipeline stats');
      }
      const result = await response.json();
      setPipelineStats(result);
    } catch (err) {
      console.error('Error fetching pipeline stats:', err);
    } finally {
      setPipelineStatsLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="h-full overflow-y-auto p-8">
        <h1 className="text-2xl font-bold mb-4">Market Aggregate</h1>
        <div className="mt-8 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
          </div>
          <Skeleton className="h-64" />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="h-full overflow-y-auto p-8">
        <h1 className="text-2xl font-bold mb-4">Market Aggregate</h1>
        <Card className="mt-8">
          <CardContent className="pt-6">
            <div className="text-destructive">Error: {error || 'Failed to load data'}</div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto p-8">
      <h1 className="text-2xl font-bold mb-4">Market Aggregate</h1>

      <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Capture</CardTitle>
            <CardDescription>Raw listings captured</CardDescription>
          </CardHeader>
          <CardContent>
            {pipelineStatsLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : pipelineStats ? (
              <div className="text-2xl font-bold">{pipelineStats.rawListings.toLocaleString()}</div>
            ) : (
              <div className="text-sm text-muted-foreground">No data available</div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Materialise</CardTitle>
            <CardDescription>Listings materialised</CardDescription>
          </CardHeader>
          <CardContent>
            {pipelineStatsLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-6 w-32" />
                <Skeleton className="h-6 w-32" />
              </div>
            ) : pipelineStats ? (
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Materialised</span>
                  <span className="text-lg font-semibold">{pipelineStats.listings.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Not yet materialised</span>
                  <span className="text-lg font-semibold">
                    {Math.max(0, pipelineStats.rawListings - pipelineStats.listings).toLocaleString()}
                  </span>
                </div>
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">No data available</div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Enrich</CardTitle>
            <CardDescription>Listings enriched</CardDescription>
          </CardHeader>
          <CardContent>
            {pipelineStatsLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-6 w-32" />
                <Skeleton className="h-6 w-32" />
              </div>
            ) : pipelineStats ? (
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Enriched</span>
                  <span className="text-lg font-semibold">{pipelineStats.enrichedListings.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Not yet enriched</span>
                  <span className="text-lg font-semibold">
                    {Math.max(0, pipelineStats.listings - pipelineStats.enrichedListings).toLocaleString()}
                  </span>
                </div>
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">No data available</div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="mt-8">
        <Card>
          <CardHeader>
            <CardTitle>Pipeline Data Overview</CardTitle>
            <CardDescription>
              Number of records at each pipeline stage
            </CardDescription>
          </CardHeader>
          <CardContent>
            {pipelineStatsLoading ? (
              <Skeleton className="h-[300px] w-full" />
            ) : pipelineStats ? (
              (() => {
                const chartData = [
                  { 
                    stage: 'Raw Listings', 
                    count: pipelineStats.rawListings,
                    percentage: 100 // First bar is always 100%
                  },
                  { 
                    stage: 'Listings', 
                    count: pipelineStats.listings,
                    percentage: pipelineStats.rawListings > 0 
                      ? (pipelineStats.listings / pipelineStats.rawListings) * 100 
                      : 0
                  },
                  { 
                    stage: 'Enriched', 
                    count: pipelineStats.enrichedListings,
                    percentage: pipelineStats.listings > 0 
                      ? (pipelineStats.enrichedListings / pipelineStats.listings) * 100 
                      : 0
                  },
                  { 
                    stage: 'Analyzed', 
                    count: pipelineStats.analyzedListings,
                    percentage: pipelineStats.enrichedListings > 0 
                      ? (pipelineStats.analyzedListings / pipelineStats.enrichedListings) * 100 
                      : 0
                  },
                ];

                const chartConfig = {
                  count: {
                    label: 'Count',
                    color: 'var(--chart-1)',
                  },
                  percentage: {
                    label: 'Percentage',
                    color: 'var(--chart-2)',
                  },
                } satisfies ChartConfig;

                return (
                  <ChartContainer config={chartConfig}>
                    <BarChart
                      accessibilityLayer
                      data={chartData}
                      margin={{
                        top: 20,
                      }}
                    >
                      <CartesianGrid vertical={false} />
                      <XAxis
                        dataKey="stage"
                        tickLine={false}
                        tickMargin={10}
                        axisLine={false}
                      />
                      <YAxis tickLine={false} axisLine={false} tickFormatter={(value: string | number) => Number.parseInt(String(value)).toLocaleString()} />
                      <ChartTooltip
                        cursor={false}
                        content={<ChartTooltipContent hideLabel formatter={(value) => {
                        const i = chartData.findIndex(d => d.count === value);
                        if (i === -1) return value;
                        const pc = chartData[i].percentage.toFixed(2) + '%';

                        return `Converted: ${pc}`;
                        }} />}
                      />
                      <Bar dataKey="count" fill="var(--color-count)" radius={2}>
                        <LabelList
                          position="top"
                          offset={12}
                          className="fill-foreground"
                          fontSize={12}
                          formatter={(value: string | number) => Number.parseInt(String(value)).toLocaleString()}
                        />
                      </Bar>
                    </BarChart>
                  </ChartContainer>
                );
              })()
            ) : <div className="text-sm text-muted-foreground">No pipeline stats available</div>}
          </CardContent>
        </Card>
      </div>

      <div className="mt-8">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Price Distribution</CardTitle>
              <div className="flex items-center gap-2">
                <Label htmlFor="buckets">Number of Buckets:</Label>
                <select
                  id="buckets"
                  value={numberOfBuckets}
                  onChange={(e) => setNumberOfBuckets(Number(e.target.value))}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <option value={5}>5</option>
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {data.priceDistribution && data.priceDistribution.bins && data.priceDistribution.bins.length > 0 ? (
              <div className="space-y-4">
                <div className="flex gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Min Price: </span>
                    <span className="font-semibold">${data.priceDistribution.minPrice.toFixed(2)}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Max Price: </span>
                    <span className="font-semibold">${data.priceDistribution.maxPrice.toFixed(2)}</span>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2 px-4 text-sm font-semibold">Price Range</th>
                        <th className="text-right py-2 px-4 text-sm font-semibold">Listings</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.priceDistribution.bins.map((bin, index) => (
                        <tr key={index} className="border-b hover:bg-muted/50">
                          <td className="py-2 px-4 text-sm">${bin.range}</td>
                          <td className="py-2 px-4 text-sm text-right">{bin.count.toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">No price data available</div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

