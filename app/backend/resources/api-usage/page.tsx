// Backend page to view eBay API usage statistics

'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

interface UsageStat {
  endpoint_type: 'item_summary_search' | 'get_item';
  total_calls: number;
  successful_calls: number;
  failed_calls: number;
  calls_in_last_24h: number;
  limit_per_day: number;
  percentage_used: number;
}

interface UsageData {
  app_id: string;
  hours: number;
  stats: UsageStat[];
  timestamp: string;
}

const ENDPOINT_NAMES: Record<string, string> = {
  item_summary_search: 'Search API (item_summary/search)',
  get_item: 'Get Item API',
};

const ENDPOINT_DESCRIPTIONS: Record<string, string> = {
  item_summary_search: 'All Browse API methods except getItems',
  get_item: 'getItems endpoint',
};

export default function ApiUsagePage() {
  const [data, setData] = useState<UsageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hours, setHours] = useState<number>(24);
  const [autoRefresh, setAutoRefresh] = useState(false);

  useEffect(() => {
    fetchData();
  }, [hours]);

  useEffect(() => {
    if (autoRefresh) {
      const interval = setInterval(() => {
        fetchData();
      }, 30000); // Refresh every 30 seconds
      return () => clearInterval(interval);
    }
  }, [autoRefresh, hours]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/ebay/usage?hours=${hours}`);
      if (!response.ok) {
        throw new Error('Failed to fetch API usage data');
      }
      const result = await response.json();
      setData(result);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (percentage: number): string => {
    if (percentage >= 90) return 'text-destructive';
    if (percentage >= 75) return 'text-orange-500';
    if (percentage >= 50) return 'text-yellow-500';
    return 'text-green-500';
  };

  const getStatusBgColor = (percentage: number): string => {
    if (percentage >= 90) return 'bg-destructive/10';
    if (percentage >= 75) return 'bg-orange-500/10';
    if (percentage >= 50) return 'bg-yellow-500/10';
    return 'bg-green-500/10';
  };

  if (loading && !data) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold mb-4">eBay API Usage</h1>
        <div className="mt-8 space-y-4">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold mb-4">eBay API Usage</h1>
        <Card className="mt-8">
          <CardContent className="pt-6">
            <div className="text-destructive">Error: {error}</div>
            <button
              onClick={fetchData}
              className="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
            >
              Retry
            </button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">eBay API Usage</h1>
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="rounded"
            />
            Auto-refresh (30s)
          </label>
          <select
            value={hours}
            onChange={(e) => setHours(Number(e.target.value))}
            className="flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <option value={1}>Last 1 hour</option>
            <option value={6}>Last 6 hours</option>
            <option value={24}>Last 24 hours</option>
            <option value={48}>Last 48 hours</option>
            <option value={168}>Last 7 days</option>
          </select>
          <button
            onClick={fetchData}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 text-sm"
          >
            Refresh
          </button>
        </div>
      </div>

      {data && (
        <>
          <div className="mb-4 text-sm text-muted-foreground">
            App ID: <span className="font-mono">{data.app_id}</span>
            {data.timestamp && (
              <> • Last updated: {new Date(data.timestamp).toLocaleString()}</>
            )}
          </div>

          <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-4">
            {data.stats.map((stat) => (
              <Card key={stat.endpoint_type}>
                <CardHeader>
                  <CardTitle>{ENDPOINT_NAMES[stat.endpoint_type]}</CardTitle>
                  <CardDescription>
                    {ENDPOINT_DESCRIPTIONS[stat.endpoint_type]}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {/* Usage percentage with visual indicator */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium">Usage (Last 24h)</span>
                        <span className={`text-lg font-bold ${getStatusColor(stat.percentage_used)}`}>
                          {stat.percentage_used.toFixed(2)}%
                        </span>
                      </div>
                      <div className="w-full bg-muted rounded-full h-3 overflow-hidden">
                        <div
                          className={`h-full transition-all ${getStatusBgColor(stat.percentage_used)}`}
                          style={{ width: `${Math.min(stat.percentage_used, 100)}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-xs text-muted-foreground mt-1">
                        <span>{stat.calls_in_last_24h.toLocaleString()} calls</span>
                        <span>Limit: {stat.limit_per_day.toLocaleString()}/day</span>
                      </div>
                    </div>

                    {/* Statistics */}
                    <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                      <div>
                        <div className="text-xs text-muted-foreground">Total Calls</div>
                        <div className="text-lg font-semibold">
                          {stat.total_calls.toLocaleString()}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground">Successful</div>
                        <div className="text-lg font-semibold text-green-500">
                          {stat.successful_calls.toLocaleString()}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground">Failed</div>
                        <div className="text-lg font-semibold text-destructive">
                          {stat.failed_calls.toLocaleString()}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground">Remaining Today</div>
                        <div className="text-lg font-semibold">
                          {Math.max(0, stat.limit_per_day - stat.calls_in_last_24h).toLocaleString()}
                        </div>
                      </div>
                    </div>

                    {/* Warning if near limit */}
                    {stat.percentage_used >= 75 && (
                      <div className={`p-3 rounded-md ${getStatusBgColor(stat.percentage_used)} border ${getStatusColor(stat.percentage_used)} border-opacity-30`}>
                        <div className="text-sm font-medium">
                          {stat.percentage_used >= 90
                            ? '⚠️ Approaching rate limit!'
                            : '⚠️ High usage - monitor closely'}
                        </div>
                        <div className="text-xs mt-1">
                          {stat.calls_in_last_24h} of {stat.limit_per_day} calls used today
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Summary information */}
          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Rate Limit Information</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-sm space-y-2 text-muted-foreground">
                <p>
                  <strong className="text-foreground">eBay Browse API Limits:</strong>
                </p>
                <ul className="list-disc list-inside space-y-1 ml-4">
                  <li>
                    <strong>Search API (item_summary/search):</strong> 5,000 calls per day
                  </li>
                  <li>
                    <strong>Get Item API:</strong> 5,000 calls per day
                  </li>
                </ul>
                <p className="mt-4">
                  Limits are tied to your eBay Application ID and reset daily. 
                  Usage is tracked automatically for all API calls made through the system.
                </p>
                <p className="text-xs mt-2">
                  Note: If eBay provides rate limit headers in API responses, they will be captured and displayed here.
                  Otherwise, usage is tracked based on our internal call counting.
                </p>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
