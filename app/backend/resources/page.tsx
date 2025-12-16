// Backend page to view aggregated market statistics

'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';

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

export default function ResourcesPage() {
  const [data, setData] = useState<AggregateData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [numberOfBuckets, setNumberOfBuckets] = useState<number>(5);

  useEffect(() => {
    fetchData();
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

  if (loading) {
    return (
      <div className="p-8">
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
      <div className="p-8">
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
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">Market Aggregate</h1>

      <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader>
            <CardDescription>Total Listings</CardDescription>
            <CardTitle className="text-2xl">{data.basic.totalListings.toLocaleString()}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Analysis</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">With Analysis</span>
                <span className="text-lg font-semibold">{data.basic.withAnalysis.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Without Analysis</span>
                <span className="text-lg font-semibold">{data.basic.withoutAnalysis.toLocaleString()}</span>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Price Per Piece</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">With Estimate</span>
                <span className="text-lg font-semibold">{data.basic.withPricePerPiece.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Without Estimate</span>
                <span className="text-lg font-semibold">{data.basic.withoutPricePerPiece.toLocaleString()}</span>
              </div>
            </div>
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

