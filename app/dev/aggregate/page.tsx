// Dev page to view aggregated market statistics

'use client';

import { useEffect, useState } from 'react';
import DevNav from '../components/DevNav';

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

export default function AggregatePage() {
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
      <div className="p-8 bg-background text-foreground">
        <h1 className="text-2xl font-bold mb-4">Market Aggregate</h1>
        <DevNav />
        <div className="mt-8 text-foreground/70">Loading aggregate data...</div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-8 bg-background text-foreground">
        <h1 className="text-2xl font-bold mb-4">Market Aggregate</h1>
        <DevNav />
        <div className="mt-8 text-foreground">Error: {error || 'Failed to load data'}</div>
      </div>
    );
  }

  return (
    <div className="p-8 bg-background text-foreground">
      <h1 className="text-2xl font-bold mb-4">Market Aggregate</h1>
      <DevNav />

      <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-background border border-foreground/10 p-4 rounded-lg">
          <div className="text-sm text-foreground/70">Total Listings</div>
          <div className="text-2xl font-bold text-foreground">{data.basic.totalListings.toLocaleString()}</div>
        </div>
        <div className="bg-background border border-foreground/10 p-4 rounded-lg">
          <div className="text-sm text-foreground/70 mb-2">Analysis</div>
          <div className="space-y-1">
            <div className="flex justify-between items-center">
              <span className="text-sm text-foreground/70">With Analysis</span>
              <span className="text-lg font-semibold text-foreground">{data.basic.withAnalysis.toLocaleString()}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-foreground/70">Without Analysis</span>
              <span className="text-lg font-semibold text-foreground">{data.basic.withoutAnalysis.toLocaleString()}</span>
            </div>
          </div>
        </div>
        <div className="bg-background border border-foreground/10 p-4 rounded-lg">
          <div className="text-sm text-foreground/70 mb-2">Price Per Piece</div>
          <div className="space-y-1">
            <div className="flex justify-between items-center">
              <span className="text-sm text-foreground/70">With Estimate</span>
              <span className="text-lg font-semibold text-foreground">{data.basic.withPricePerPiece.toLocaleString()}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-foreground/70">Without Estimate</span>
              <span className="text-lg font-semibold text-foreground">{data.basic.withoutPricePerPiece.toLocaleString()}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-8">
        <div className="bg-background border border-foreground/10 p-4 rounded-lg">
          <div className="flex items-center justify-between mb-4">
            <div className="text-sm text-foreground/70">Price Distribution</div>
            <div className="flex items-center gap-2">
              <label className="text-sm text-foreground/70">Number of Buckets:</label>
              <select
                value={numberOfBuckets}
                onChange={(e) => setNumberOfBuckets(Number(e.target.value))}
                className="px-3 py-1 border border-foreground/20 rounded bg-background text-foreground text-sm"
              >
                <option value={5}>5</option>
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>
          </div>
          {data.priceDistribution && data.priceDistribution.bins && data.priceDistribution.bins.length > 0 ? (
            <div className="space-y-4">
              <div className="flex gap-4 text-sm">
                <div>
                  <span className="text-foreground/70">Min Price: </span>
                  <span className="font-semibold text-foreground">${data.priceDistribution.minPrice.toFixed(2)}</span>
                </div>
                <div>
                  <span className="text-foreground/70">Max Price: </span>
                  <span className="font-semibold text-foreground">${data.priceDistribution.maxPrice.toFixed(2)}</span>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b border-foreground/10">
                      <th className="text-left py-2 px-4 text-sm font-semibold text-foreground">Price Range</th>
                      <th className="text-right py-2 px-4 text-sm font-semibold text-foreground">Listings</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.priceDistribution.bins.map((bin, index) => (
                      <tr key={index} className="border-b border-foreground/5 hover:bg-foreground/5">
                        <td className="py-2 px-4 text-sm text-foreground">${bin.range}</td>
                        <td className="py-2 px-4 text-sm text-foreground text-right">{bin.count.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="text-sm text-foreground/70">No price data available</div>
          )}
        </div>
      </div>
    </div>
  );
}

