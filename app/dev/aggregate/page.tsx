// Dev page to view aggregated market statistics

'use client';

import { useEffect, useState } from 'react';
import DevNav from '../components/DevNav';
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ScatterChart,
  Scatter,
  AreaChart,
  Area,
} from 'recharts';

interface AggregateData {
  basic: {
    totalListings: number;
    byStatus: Record<string, number>;
    byMarketplace: Record<string, number>;
    withAnalysis: number;
    withoutAnalysis: number;
  };
  attributeCoverage: Record<string, number>;
  pricePerPiece: {
    stats: {
      count: number;
      mean: number;
      median: number;
      p25: number;
      p75: number;
      p90: number;
      p95: number;
      p99: number;
    };
    distribution: Array<{ range: string; count: number }>;
    byCondition: Array<{ condition: string; count: number; mean: number; median: number }>;
    byMarketplace: Array<{ marketplace: string; count: number; mean: number; median: number }>;
    estimated: { count: number; mean: number; median: number };
    actual: { count: number; mean: number; median: number };
  };
  marketplace: Array<{
    marketplace: string;
    count: number;
    withAnalysis: number;
    analysisCoverage: number;
    avgPrice: number;
    avgPricePerPiece: number;
  }>;
  condition: Array<{
    condition: string;
    count: number;
    avgPrice: number;
    avgPricePerPiece: number;
  }>;
  pieceCount: {
    distribution: Array<{ range: string; count: number }>;
    estimated: { count: number; mean: number };
    actual: { count: number; mean: number };
    vsPricePerPiece: Array<{ piece_count: number; price_per_piece: number }>;
  };
  minifig: {
    distribution: Array<{ count: number; value: number }>;
    byRange: Array<{ range: string; count: number; avgPricePerPiece: number }>;
  };
  timeSeries: {
    listingsOverTime: {
      daily: Array<{ date: string; count: number; avgPrice: number; avgPricePerPiece: number; avgPieceCount: number; withAnalysis: number }>;
      weekly: Array<{ date: string; count: number; avgPrice: number; avgPricePerPiece: number; avgPieceCount: number; withAnalysis: number }>;
      monthly: Array<{ date: string; count: number; avgPrice: number; avgPricePerPiece: number; avgPieceCount: number; withAnalysis: number }>;
    };
    analysisOverTime: {
      daily: Array<{ date: string; total: number; withAnalysis: number; completionRate: number }>;
      weekly: Array<{ date: string; total: number; withAnalysis: number; completionRate: number }>;
      monthly: Array<{ date: string; total: number; withAnalysis: number; completionRate: number }>;
    };
    statusOverTime: {
      daily: Array<{ date: string } & Record<string, number | string>>;
      weekly: Array<{ date: string } & Record<string, number | string>>;
      monthly: Array<{ date: string } & Record<string, number | string>>;
    };
  };
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4'];

export default function AggregatePage() {
  const [data, setData] = useState<AggregateData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timePeriod, setTimePeriod] = useState<'7d' | '30d' | '90d' | 'all'>('all');
  const [timeInterval, setTimeInterval] = useState<'daily' | 'weekly' | 'monthly'>('daily');
  
  // Toggle states for sections
  const [showBasic, setShowBasic] = useState(true);
  const [showAttributeCoverage, setShowAttributeCoverage] = useState(true);
  const [showPricePerPiece, setShowPricePerPiece] = useState(true);
  const [showTimeTrends, setShowTimeTrends] = useState(true);
  const [showMarketplace, setShowMarketplace] = useState(true);
  const [showCondition, setShowCondition] = useState(true);
  const [showPieceCount, setShowPieceCount] = useState(true);
  const [showMinifig, setShowMinifig] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/dev/aggregate');
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

  const filterTimeSeries = <T extends { date: string }>(series: T[]): T[] => {
    if (timePeriod === 'all') return series;
    const now = new Date();
    const cutoff = new Date();
    if (timePeriod === '7d') cutoff.setDate(now.getDate() - 7);
    else if (timePeriod === '30d') cutoff.setDate(now.getDate() - 30);
    else if (timePeriod === '90d') cutoff.setDate(now.getDate() - 90);
    return series.filter((item) => new Date(item.date) >= cutoff);
  };

  if (loading) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold mb-4">Market Aggregate</h1>
        <DevNav />
        <div className="mt-8">Loading aggregate data...</div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold mb-4">Market Aggregate</h1>
        <DevNav />
        <div className="mt-8 text-red-600">Error: {error || 'Failed to load data'}</div>
      </div>
    );
  }

  const statusData = Object.entries(data.basic.byStatus).map(([name, value]) => ({
    name,
    value,
  }));

  const marketplaceData = Object.entries(data.basic.byMarketplace).map(([name, value]) => ({
    name,
    value,
  }));

  const attributeData = Object.entries(data.attributeCoverage).map(([name, value]) => ({
    name: name.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase()),
    value: Number(value.toFixed(1)),
  }));

  const timeSeriesData = filterTimeSeries(data.timeSeries.listingsOverTime[timeInterval]);
  const analysisTimeSeriesData = filterTimeSeries(data.timeSeries.analysisOverTime[timeInterval]);
  const statusTimeSeriesData = filterTimeSeries(data.timeSeries.statusOverTime[timeInterval]);

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">Market Aggregate</h1>
      <DevNav />

      {/* Basic Statistics Section */}
      <section className="mt-8 mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Basic Statistics</h2>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={showBasic}
              onChange={(e) => setShowBasic(e.target.checked)}
              className="rounded"
            />
            <span className="text-sm">Show</span>
          </label>
        </div>
        {showBasic && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="text-sm text-gray-600">Total Listings</div>
              <div className="text-2xl font-bold">{data.basic.totalListings.toLocaleString()}</div>
            </div>
            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="text-sm text-gray-600">With Analysis</div>
              <div className="text-2xl font-bold">{data.basic.withAnalysis.toLocaleString()}</div>
            </div>
            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="text-sm text-gray-600">Without Analysis</div>
              <div className="text-2xl font-bold">{data.basic.withoutAnalysis.toLocaleString()}</div>
            </div>
            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="text-sm text-gray-600">Analysis Coverage</div>
              <div className="text-2xl font-bold">
                {data.basic.totalListings > 0
                  ? ((data.basic.withAnalysis / data.basic.totalListings) * 100).toFixed(1)
                  : 0}
                %
              </div>
            </div>
          </div>
        )}
        {showBasic && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white p-4 rounded-lg border">
              <h3 className="text-lg font-semibold mb-4">Listings by Status</h3>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={statusData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) =>
                      `${name}: ${(((percent ?? 0) * 100).toFixed(0))}%`
                    }
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {statusData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="bg-white p-4 rounded-lg border">
              <h3 className="text-lg font-semibold mb-4">Listings by Marketplace</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={marketplaceData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="value" fill="#3b82f6" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </section>

      {/* Attribute Coverage Section */}
      <section className="mt-8 mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Attribute Coverage</h2>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={showAttributeCoverage}
              onChange={(e) => setShowAttributeCoverage(e.target.checked)}
              className="rounded"
            />
            <span className="text-sm">Show</span>
          </label>
        </div>
        {showAttributeCoverage && (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {attributeData.map((attr) => (
              <div key={attr.name} className="bg-gray-50 p-4 rounded-lg">
                <div className="text-sm text-gray-600 mb-1">{attr.name}</div>
                <div className="text-2xl font-bold">{attr.value}%</div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Price Per Piece Analysis Section */}
      <section className="mt-8 mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Price Per Piece Analysis</h2>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={showPricePerPiece}
              onChange={(e) => setShowPricePerPiece(e.target.checked)}
              className="rounded"
            />
            <span className="text-sm">Show</span>
          </label>
        </div>
        {showPricePerPiece && (
          <>
            <div className="bg-white p-4 rounded-lg border mb-6">
              <h3 className="text-lg font-semibold mb-4">Statistics</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4">
                <div>
                  <div className="text-sm text-gray-600">Count</div>
                  <div className="text-xl font-bold">{data.pricePerPiece.stats.count}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-600">Mean</div>
                  <div className="text-xl font-bold">${data.pricePerPiece.stats.mean.toFixed(4)}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-600">Median</div>
                  <div className="text-xl font-bold">${data.pricePerPiece.stats.median.toFixed(4)}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-600">P25</div>
                  <div className="text-xl font-bold">${data.pricePerPiece.stats.p25.toFixed(4)}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-600">P75</div>
                  <div className="text-xl font-bold">${data.pricePerPiece.stats.p75.toFixed(4)}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-600">P90</div>
                  <div className="text-xl font-bold">${data.pricePerPiece.stats.p90.toFixed(4)}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-600">P95</div>
                  <div className="text-xl font-bold">${data.pricePerPiece.stats.p95.toFixed(4)}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-600">P99</div>
                  <div className="text-xl font-bold">${data.pricePerPiece.stats.p99.toFixed(4)}</div>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div className="bg-white p-4 rounded-lg border">
                <h3 className="text-lg font-semibold mb-4">Distribution</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={data.pricePerPiece.distribution}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="range" angle={-45} textAnchor="end" height={100} />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="count" fill="#3b82f6" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="bg-white p-4 rounded-lg border">
                <h3 className="text-lg font-semibold mb-4">By Condition</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={data.pricePerPiece.byCondition}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="condition" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="mean" fill="#3b82f6" name="Mean" />
                    <Bar dataKey="median" fill="#10b981" name="Median" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white p-4 rounded-lg border">
                <h3 className="text-lg font-semibold mb-4">By Marketplace</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={data.pricePerPiece.byMarketplace}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="marketplace" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="mean" fill="#3b82f6" name="Mean" />
                    <Bar dataKey="median" fill="#10b981" name="Median" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="bg-white p-4 rounded-lg border">
                <h3 className="text-lg font-semibold mb-4">Estimated vs Actual</h3>
                <div className="space-y-4">
                  <div>
                    <div className="text-sm text-gray-600">Estimated</div>
                    <div className="text-lg">Count: {data.pricePerPiece.estimated.count}</div>
                    <div className="text-lg">Mean: ${data.pricePerPiece.estimated.mean.toFixed(4)}</div>
                    <div className="text-lg">Median: ${data.pricePerPiece.estimated.median.toFixed(4)}</div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-600">Actual</div>
                    <div className="text-lg">Count: {data.pricePerPiece.actual.count}</div>
                    <div className="text-lg">Mean: ${data.pricePerPiece.actual.mean.toFixed(4)}</div>
                    <div className="text-lg">Median: ${data.pricePerPiece.actual.median.toFixed(4)}</div>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </section>

      {/* Time-Based Trends Section */}
      <section className="mt-8 mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Time-Based Trends</h2>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={showTimeTrends}
              onChange={(e) => setShowTimeTrends(e.target.checked)}
              className="rounded"
            />
            <span className="text-sm">Show</span>
          </label>
        </div>
        {showTimeTrends && (
          <>
            <div className="flex gap-4 mb-4">
              <select
                value={timePeriod}
                onChange={(e) => setTimePeriod(e.target.value as any)}
                className="px-3 py-2 border rounded"
              >
                <option value="7d">Last 7 days</option>
                <option value="30d">Last 30 days</option>
                <option value="90d">Last 90 days</option>
                <option value="all">All time</option>
              </select>
              <select
                value={timeInterval}
                onChange={(e) => setTimeInterval(e.target.value as any)}
                className="px-3 py-2 border rounded"
              >
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </select>
            </div>
            <div className="grid grid-cols-1 gap-6">
              <div className="bg-white p-4 rounded-lg border">
                <h3 className="text-lg font-semibold mb-4">Listings Added Over Time</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={timeSeriesData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="count" stroke="#3b82f6" name="Listings" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <div className="bg-white p-4 rounded-lg border">
                <h3 className="text-lg font-semibold mb-4">Average Price Per Piece Over Time</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={timeSeriesData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Line type="monotone" dataKey="avgPricePerPiece" stroke="#10b981" name="Avg $/Piece" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <div className="bg-white p-4 rounded-lg border">
                <h3 className="text-lg font-semibold mb-4">Analysis Completion Rate</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={analysisTimeSeriesData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Line type="monotone" dataKey="completionRate" stroke="#f59e0b" name="Completion %" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <div className="bg-white p-4 rounded-lg border">
                <h3 className="text-lg font-semibold mb-4">Status Changes Over Time</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={statusTimeSeriesData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    {Object.keys(data.basic.byStatus).map((status, index) => (
                      <Area
                        key={status}
                        type="monotone"
                        dataKey={status}
                        stackId="1"
                        stroke={COLORS[index % COLORS.length]}
                        fill={COLORS[index % COLORS.length]}
                        name={status}
                      />
                    ))}
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <div className="bg-white p-4 rounded-lg border">
                <h3 className="text-lg font-semibold mb-4">Average Price Trends</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={timeSeriesData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Line type="monotone" dataKey="avgPrice" stroke="#ef4444" name="Avg Price" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <div className="bg-white p-4 rounded-lg border">
                <h3 className="text-lg font-semibold mb-4">Average Piece Count Trends</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={timeSeriesData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Line type="monotone" dataKey="avgPieceCount" stroke="#8b5cf6" name="Avg Pieces" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </>
        )}
      </section>

      {/* Marketplace Comparison Section */}
      <section className="mt-8 mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Marketplace Comparison</h2>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={showMarketplace}
              onChange={(e) => setShowMarketplace(e.target.checked)}
              className="rounded"
            />
            <span className="text-sm">Show</span>
          </label>
        </div>
        {showMarketplace && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white p-4 rounded-lg border">
              <h3 className="text-lg font-semibold mb-4">Listings Count</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={data.marketplace}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="marketplace" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="count" fill="#3b82f6" />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="bg-white p-4 rounded-lg border">
              <h3 className="text-lg font-semibold mb-4">Average Price</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={data.marketplace}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="marketplace" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="avgPrice" fill="#10b981" />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="bg-white p-4 rounded-lg border">
              <h3 className="text-lg font-semibold mb-4">Average Price Per Piece</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={data.marketplace}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="marketplace" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="avgPricePerPiece" fill="#f59e0b" />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="bg-white p-4 rounded-lg border">
              <h3 className="text-lg font-semibold mb-4">Analysis Coverage</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={data.marketplace}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="marketplace" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="analysisCoverage" fill="#ef4444" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </section>

      {/* Condition Analysis Section */}
      <section className="mt-8 mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Condition Analysis</h2>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={showCondition}
              onChange={(e) => setShowCondition(e.target.checked)}
              className="rounded"
            />
            <span className="text-sm">Show</span>
          </label>
        </div>
        {showCondition && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white p-4 rounded-lg border">
              <h3 className="text-lg font-semibold mb-4">Distribution</h3>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={data.condition}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, value, percent }) =>
                      `${name ?? value}: ${(((percent ?? 0) * 100).toFixed(0))}%`
                    }
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="count"
                  >
                    {data.condition.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="bg-white p-4 rounded-lg border">
              <h3 className="text-lg font-semibold mb-4">Average Price Per Piece</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={data.condition}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="condition" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="avgPricePerPiece" fill="#3b82f6" />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="bg-white p-4 rounded-lg border">
              <h3 className="text-lg font-semibold mb-4">Average Price</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={data.condition}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="condition" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="avgPrice" fill="#10b981" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </section>

      {/* Piece Count Analysis Section */}
      <section className="mt-8 mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Piece Count Analysis</h2>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={showPieceCount}
              onChange={(e) => setShowPieceCount(e.target.checked)}
              className="rounded"
            />
            <span className="text-sm">Show</span>
          </label>
        </div>
        {showPieceCount && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white p-4 rounded-lg border">
              <h3 className="text-lg font-semibold mb-4">Distribution</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={data.pieceCount.distribution}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="range" angle={-45} textAnchor="end" height={100} />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="count" fill="#3b82f6" />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="bg-white p-4 rounded-lg border">
              <h3 className="text-lg font-semibold mb-4">Price Per Piece vs Piece Count</h3>
              <ResponsiveContainer width="100%" height={300}>
                <ScatterChart data={data.pieceCount.vsPricePerPiece}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" dataKey="piece_count" name="Piece Count" />
                  <YAxis type="number" dataKey="price_per_piece" name="Price Per Piece" />
                  <Tooltip cursor={{ strokeDasharray: '3 3' }} />
                  <Scatter name="Listings" dataKey="price_per_piece" fill="#3b82f6" />
                </ScatterChart>
              </ResponsiveContainer>
            </div>
            <div className="bg-white p-4 rounded-lg border">
              <h3 className="text-lg font-semibold mb-4">Estimated vs Actual</h3>
              <div className="space-y-4">
                <div>
                  <div className="text-sm text-gray-600">Estimated</div>
                  <div className="text-lg">Count: {data.pieceCount.estimated.count}</div>
                  <div className="text-lg">Mean: {data.pieceCount.estimated.mean.toFixed(0)} pieces</div>
                </div>
                <div>
                  <div className="text-sm text-gray-600">Actual</div>
                  <div className="text-lg">Count: {data.pieceCount.actual.count}</div>
                  <div className="text-lg">Mean: {data.pieceCount.actual.mean.toFixed(0)} pieces</div>
                </div>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Minifig Analysis Section */}
      <section className="mt-8 mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Minifig Analysis</h2>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={showMinifig}
              onChange={(e) => setShowMinifig(e.target.checked)}
              className="rounded"
            />
            <span className="text-sm">Show</span>
          </label>
        </div>
        {showMinifig && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white p-4 rounded-lg border">
              <h3 className="text-lg font-semibold mb-4">Distribution</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={data.minifig.distribution}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="count" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="value" fill="#3b82f6" />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="bg-white p-4 rounded-lg border">
              <h3 className="text-lg font-semibold mb-4">Average Price Per Piece by Range</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={data.minifig.byRange}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="range" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="avgPricePerPiece" fill="#10b981" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

