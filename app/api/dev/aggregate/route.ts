// API route to aggregate statistics from all listings

import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase/client';
import type { Database } from '@/lib/supabase/supabase.types';

// Type for listing with joined analysis data
type ListingWithAnalysis = Database['pipeline']['Tables']['listings']['Row'] & {
  listing_analysis: Database['pipeline']['Tables']['listing_analysis']['Row'][];
};

function calculatePercentile(sorted: number[], percentile: number): number {
  if (sorted.length === 0) return 0;
  const index = Math.ceil((percentile / 100) * sorted.length) - 1;
  return sorted[Math.max(0, index)];
}

function groupByDate(
  data: ListingWithAnalysis[],
  dateField: 'created_at' | 'first_seen_at' | 'analyzed_at',
  interval: 'day' | 'week' | 'month'
): Map<string, ListingWithAnalysis[]> {
  const grouped = new Map<string, ListingWithAnalysis[]>();
  
  for (const item of data) {
    let date: Date;
    if (dateField === 'analyzed_at') {
      const analysis = item.listing_analysis?.[0];
      if (!analysis?.analyzed_at) continue;
      date = new Date(analysis.analyzed_at);
    } else {
      const fieldValue = item[dateField];
      if (!fieldValue) continue;
      date = new Date(fieldValue);
    }
    
    let key: string;
    if (interval === 'day') {
      key = date.toISOString().split('T')[0];
    } else if (interval === 'week') {
      const weekStart = new Date(date);
      weekStart.setDate(date.getDate() - date.getDay());
      key = weekStart.toISOString().split('T')[0];
    } else {
      key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    }
    
    if (!grouped.has(key)) {
      grouped.set(key, []);
    }
    grouped.get(key)!.push(item);
  }
  
  return grouped;
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const numberOfBuckets = parseInt(searchParams.get('numberOfBuckets') || '5', 10);
    const validNumberOfBuckets = [5, 10, 25, 50, 100];
    const priceBinCount = validNumberOfBuckets.includes(numberOfBuckets) ? numberOfBuckets : 5;

    // Fetch all listings with their analysis data
    const { data: listings, error } = await supabase
      .schema('pipeline')
      .from('listings')
      .select('*, listing_analysis(*)')
      .order('created_at', { ascending: true });

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    const listingsData = (listings || []) as ListingWithAnalysis[];
    const totalListings = listingsData.length;

    // Basic counts
    const byStatus = listingsData.reduce((acc, listing) => {
      const status = listing.status || 'unknown';
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const byMarketplace = listingsData.reduce((acc, listing) => {
      acc[listing.marketplace] = (acc[listing.marketplace] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const withAnalysis = listingsData.filter(
      (l) => l.listing_analysis && l.listing_analysis.length > 0
    ).length;
    const withoutAnalysis = totalListings - withAnalysis;

    const withPricePerPiece = listingsData.filter(
      (l) => l.listing_analysis?.[0]?.price_per_piece != null
    ).length;
    const withoutPricePerPiece = totalListings - withPricePerPiece;

    // Price distribution
    const priceValues = listingsData
      .map((l) => l.price)
      .filter((v): v is number => v !== null && v !== undefined && !isNaN(v) && v > 0)
      .sort((a, b) => a - b);

    const minPrice = priceValues.length > 0 ? Math.min(...priceValues) : 0;
    const maxPrice = priceValues.length > 0 ? Math.max(...priceValues) : 0;
    const priceBinSize = maxPrice > 0 ? maxPrice / priceBinCount : 1;
    const priceBins = Array.from({ length: priceBinCount }, (_, i) => ({
      range: `${(i * priceBinSize).toFixed(0)}-${((i + 1) * priceBinSize).toFixed(0)}`,
      min: i * priceBinSize,
      max: (i + 1) * priceBinSize,
      count: 0,
    }));

    for (const value of priceValues) {
      const binIndex = Math.min(Math.floor(value / priceBinSize), priceBinCount - 1);
      priceBins[binIndex].count++;
    }

    // Attribute coverage
    const attributeCoverage = {
      price: (listingsData.filter((l) => l.price !== null).length / totalListings) * 100,
      description: (listingsData.filter((l) => l.description !== null && l.description.trim() !== '').length / totalListings) * 100,
      location: (listingsData.filter((l) => l.location !== null && l.location.trim() !== '').length / totalListings) * 100,
      seller_name: (listingsData.filter((l) => l.seller_name !== null && l.seller_name.trim() !== '').length / totalListings) * 100,
      seller_rating: (listingsData.filter((l) => l.seller_rating !== null).length / totalListings) * 100,
      piece_count: (listingsData.filter((l) => l.listing_analysis?.[0]?.piece_count !== null).length / totalListings) * 100,
      estimated_piece_count: (listingsData.filter((l) => l.listing_analysis?.[0]?.estimated_piece_count === true).length / totalListings) * 100,
      minifig_count: (listingsData.filter((l) => l.listing_analysis?.[0]?.minifig_count !== null).length / totalListings) * 100,
      estimated_minifig_count: (listingsData.filter((l) => l.listing_analysis?.[0]?.estimated_minifig_count === true).length / totalListings) * 100,
      condition: (listingsData.filter((l) => l.listing_analysis?.[0]?.condition && l.listing_analysis[0].condition !== 'unknown').length / totalListings) * 100,
      price_per_piece: (listingsData.filter((l) => l.listing_analysis?.[0]?.price_per_piece !== null).length / totalListings) * 100,
    };

    // Price per piece statistics
    const pricePerPieceValues = listingsData
      .map((l) => l.listing_analysis?.[0]?.price_per_piece)
      .filter((v): v is number => v !== null && v !== undefined && !isNaN(v))
      .sort((a, b) => a - b);

    const pricePerPieceStats = {
      count: pricePerPieceValues.length,
      mean: pricePerPieceValues.length > 0
        ? pricePerPieceValues.reduce((a, b) => a + b, 0) / pricePerPieceValues.length
        : 0,
      median: pricePerPieceValues.length > 0
        ? calculatePercentile(pricePerPieceValues, 50)
        : 0,
      p25: pricePerPieceValues.length > 0
        ? calculatePercentile(pricePerPieceValues, 25)
        : 0,
      p75: pricePerPieceValues.length > 0
        ? calculatePercentile(pricePerPieceValues, 75)
        : 0,
      p90: pricePerPieceValues.length > 0
        ? calculatePercentile(pricePerPieceValues, 90)
        : 0,
      p95: pricePerPieceValues.length > 0
        ? calculatePercentile(pricePerPieceValues, 95)
        : 0,
      p99: pricePerPieceValues.length > 0
        ? calculatePercentile(pricePerPieceValues, 99)
        : 0,
    };

    // Price per piece distribution bins (histogram)
    const maxPPP = pricePerPieceValues.length > 0 ? Math.max(...pricePerPieceValues) : 0;
    const binCount = 20;
    const binSize = maxPPP > 0 ? maxPPP / binCount : 1;
    const bins = Array.from({ length: binCount }, (_, i) => ({
      range: `${(i * binSize).toFixed(2)}-${((i + 1) * binSize).toFixed(2)}`,
      min: i * binSize,
      max: (i + 1) * binSize,
      count: 0,
    }));

    for (const value of pricePerPieceValues) {
      const binIndex = Math.min(Math.floor(value / binSize), binCount - 1);
      bins[binIndex].count++;
    }

    // Price per piece by condition
    const pppByCondition = listingsData.reduce((acc, listing) => {
      const analysis = listing.listing_analysis?.[0];
      if (!analysis?.price_per_piece || !analysis.condition) return acc;
      const condition = analysis.condition;
      if (!acc[condition]) {
        acc[condition] = [];
      }
      acc[condition].push(analysis.price_per_piece);
      return acc;
    }, {} as Record<string, number[]>);

    const pppByConditionStats = Object.entries(pppByCondition).map(([condition, values]) => ({
      condition,
      count: values.length,
      mean: values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0,
      median: values.length > 0 ? calculatePercentile([...values].sort((a, b) => a - b), 50) : 0,
    }));

    // Price per piece by marketplace
    const pppByMarketplace = listingsData.reduce((acc, listing) => {
      const analysis = listing.listing_analysis?.[0];
      if (!analysis?.price_per_piece) return acc;
      const marketplace = listing.marketplace;
      if (!acc[marketplace]) {
        acc[marketplace] = [];
      }
      acc[marketplace].push(analysis.price_per_piece);
      return acc;
    }, {} as Record<string, number[]>);

    const pppByMarketplaceStats = Object.entries(pppByMarketplace).map(([marketplace, values]) => ({
      marketplace,
      count: values.length,
      mean: values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0,
      median: values.length > 0 ? calculatePercentile([...values].sort((a, b) => a - b), 50) : 0,
    }));

    // Price per piece by estimated vs actual
    const pppEstimated = listingsData
      .filter((l) => l.listing_analysis?.[0]?.estimated_piece_count === true)
      .map((l) => l.listing_analysis?.[0]?.price_per_piece)
      .filter((v): v is number => v !== null && v !== undefined && !isNaN(v));

    const pppActual = listingsData
      .filter((l) => l.listing_analysis?.[0]?.estimated_piece_count === false && l.listing_analysis?.[0]?.piece_count !== null)
      .map((l) => l.listing_analysis?.[0]?.price_per_piece)
      .filter((v): v is number => v !== null && v !== undefined && !isNaN(v));

    // Marketplace comparison
    const marketplaceStats = Object.entries(byMarketplace).map(([marketplace, count]) => {
      const marketplaceListings = listingsData.filter((l) => l.marketplace === marketplace);
      const withAnalysisCount = marketplaceListings.filter(
        (l) => l.listing_analysis && l.listing_analysis.length > 0
      ).length;
      
      const prices = marketplaceListings
        .map((l) => l.price)
        .filter((v): v is number => v !== null && v !== undefined && !isNaN(v));
      
      const avgPrice = prices.length > 0
        ? prices.reduce((a, b) => a + b, 0) / prices.length
        : 0;

      const ppp = marketplaceListings
        .map((l) => l.listing_analysis?.[0]?.price_per_piece)
        .filter((v): v is number => v !== null && v !== undefined && !isNaN(v));
      
      const avgPPP = ppp.length > 0
        ? ppp.reduce((a, b) => a + b, 0) / ppp.length
        : 0;

      return {
        marketplace,
        count,
        withAnalysis: withAnalysisCount,
        analysisCoverage: (withAnalysisCount / count) * 100,
        avgPrice,
        avgPricePerPiece: avgPPP,
      };
    });

    // Condition distribution
    const byCondition = listingsData.reduce((acc, listing) => {
      const condition = listing.listing_analysis?.[0]?.condition || 'unknown';
      acc[condition] = (acc[condition] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const conditionStats = Object.entries(byCondition).map(([condition, count]) => {
      const conditionListings = listingsData.filter(
        (l) => (l.listing_analysis?.[0]?.condition || 'unknown') === condition
      );
      
      const prices = conditionListings
        .map((l) => l.price)
        .filter((v): v is number => v !== null && v !== undefined && !isNaN(v));
      
      const avgPrice = prices.length > 0
        ? prices.reduce((a, b) => a + b, 0) / prices.length
        : 0;

      const ppp = conditionListings
        .map((l) => l.listing_analysis?.[0]?.price_per_piece)
        .filter((v): v is number => v !== null && v !== undefined && !isNaN(v));
      
      const avgPPP = ppp.length > 0
        ? ppp.reduce((a, b) => a + b, 0) / ppp.length
        : 0;

      return {
        condition,
        count,
        avgPrice,
        avgPricePerPiece: avgPPP,
      };
    });

    // Piece count distribution
    const pieceCounts = listingsData
      .map((l) => l.listing_analysis?.[0]?.piece_count)
      .filter((v): v is number => v !== null && v !== undefined && !isNaN(v) && v > 0)
      .sort((a, b) => a - b);

    const maxPieces = pieceCounts.length > 0 ? Math.max(...pieceCounts) : 0;
    const pieceBinCount = 20;
    const pieceBinSize = maxPieces > 0 ? maxPieces / pieceBinCount : 1;
    const pieceBins = Array.from({ length: pieceBinCount }, (_, i) => ({
      range: `${Math.floor(i * pieceBinSize)}-${Math.floor((i + 1) * pieceBinSize)}`,
      min: i * pieceBinSize,
      max: (i + 1) * pieceBinSize,
      count: 0,
    }));

    for (const value of pieceCounts) {
      const binIndex = Math.min(Math.floor(value / pieceBinSize), pieceBinCount - 1);
      pieceBins[binIndex].count++;
    }

    // Estimated vs actual piece count comparison
    const estimatedPieceCounts = listingsData
      .filter((l) => l.listing_analysis?.[0]?.estimated_piece_count === true)
      .map((l) => l.listing_analysis?.[0]?.piece_count)
      .filter((v): v is number => v !== null && v !== undefined && !isNaN(v) && v > 0);

    const actualPieceCounts = listingsData
      .filter((l) => l.listing_analysis?.[0]?.estimated_piece_count === false)
      .map((l) => l.listing_analysis?.[0]?.piece_count)
      .filter((v): v is number => v !== null && v !== undefined && !isNaN(v) && v > 0);

    // Price per piece vs piece count (for scatter plot)
    const pppVsPieces = listingsData
      .map((l) => {
        const analysis = l.listing_analysis?.[0];
        if (!analysis?.piece_count || !analysis?.price_per_piece) return null;
        return {
          piece_count: analysis.piece_count,
          price_per_piece: analysis.price_per_piece,
        };
      })
      .filter((v): v is { piece_count: number; price_per_piece: number } => v !== null);

    // Minifig count distribution
    const minifigCounts = listingsData
      .map((l) => l.listing_analysis?.[0]?.minifig_count)
      .filter((v): v is number => v !== null && v !== undefined && !isNaN(v) && v >= 0)
      .sort((a, b) => a - b);

    const maxMinifigs = minifigCounts.length > 0 ? Math.max(...minifigCounts) : 0;
    const minifigBinCount = Math.min(20, maxMinifigs + 1);
    const minifigBins = Array.from({ length: minifigBinCount }, (_, i) => ({
      count: i,
      value: minifigCounts.filter((c) => c === i).length,
    }));

    // Price per piece by minifig count ranges
    const minifigRanges = [
      { label: '0', min: 0, max: 0 },
      { label: '1-2', min: 1, max: 2 },
      { label: '3-5', min: 3, max: 5 },
      { label: '6-10', min: 6, max: 10 },
      { label: '11+', min: 11, max: Infinity },
    ];

    const pppByMinifigRange = minifigRanges.map((range) => {
      const matching = listingsData
        .filter((l) => {
          const count = l.listing_analysis?.[0]?.minifig_count;
          return count !== null && count !== undefined && count >= range.min && count <= range.max;
        })
        .map((l) => l.listing_analysis?.[0]?.price_per_piece)
        .filter((v): v is number => v !== null && v !== undefined && !isNaN(v));

      return {
        range: range.label,
        count: matching.length,
        avgPricePerPiece: matching.length > 0
          ? matching.reduce((a, b) => a + b, 0) / matching.length
          : 0,
      };
    });

    // Time-based trends
    const timeSeriesDaily = groupByDate(listingsData, 'created_at', 'day');
    const timeSeriesWeekly = groupByDate(listingsData, 'created_at', 'week');
    const timeSeriesMonthly = groupByDate(listingsData, 'created_at', 'month');

    const listingsOverTime = {
      daily: Array.from(timeSeriesDaily.entries())
        .map(([date, items]) => {
          const prices = items
            .map((i) => i.price)
            .filter((v): v is number => v !== null && v !== undefined && !isNaN(v));
          const ppp = items
            .map((i) => i.listing_analysis?.[0]?.price_per_piece)
            .filter((v): v is number => v !== null && v !== undefined && !isNaN(v));
          const pieces = items
            .map((i) => i.listing_analysis?.[0]?.piece_count)
            .filter((v): v is number => v !== null && v !== undefined && !isNaN(v) && v > 0);
          return {
            date,
            count: items.length,
            avgPrice: prices.length > 0 ? prices.reduce((a, b) => a + b, 0) / prices.length : 0,
            avgPricePerPiece: ppp.length > 0 ? ppp.reduce((a, b) => a + b, 0) / ppp.length : 0,
            avgPieceCount: pieces.length > 0 ? pieces.reduce((a, b) => a + b, 0) / pieces.length : 0,
            withAnalysis: items.filter((i) => i.listing_analysis && i.listing_analysis.length > 0).length,
          };
        })
        .sort((a, b) => a.date.localeCompare(b.date)),
      
      weekly: Array.from(timeSeriesWeekly.entries())
        .map(([date, items]) => {
          const prices = items
            .map((i) => i.price)
            .filter((v): v is number => v !== null && v !== undefined && !isNaN(v));
          const ppp = items
            .map((i) => i.listing_analysis?.[0]?.price_per_piece)
            .filter((v): v is number => v !== null && v !== undefined && !isNaN(v));
          const pieces = items
            .map((i) => i.listing_analysis?.[0]?.piece_count)
            .filter((v): v is number => v !== null && v !== undefined && !isNaN(v) && v > 0);
          return {
            date,
            count: items.length,
            avgPrice: prices.length > 0 ? prices.reduce((a, b) => a + b, 0) / prices.length : 0,
            avgPricePerPiece: ppp.length > 0 ? ppp.reduce((a, b) => a + b, 0) / ppp.length : 0,
            avgPieceCount: pieces.length > 0 ? pieces.reduce((a, b) => a + b, 0) / pieces.length : 0,
            withAnalysis: items.filter((i) => i.listing_analysis && i.listing_analysis.length > 0).length,
          };
        })
        .sort((a, b) => a.date.localeCompare(b.date)),
      
      monthly: Array.from(timeSeriesMonthly.entries())
        .map(([date, items]) => {
          const prices = items
            .map((i) => i.price)
            .filter((v): v is number => v !== null && v !== undefined && !isNaN(v));
          const ppp = items
            .map((i) => i.listing_analysis?.[0]?.price_per_piece)
            .filter((v): v is number => v !== null && v !== undefined && !isNaN(v));
          const pieces = items
            .map((i) => i.listing_analysis?.[0]?.piece_count)
            .filter((v): v is number => v !== null && v !== undefined && !isNaN(v) && v > 0);
          return {
            date,
            count: items.length,
            avgPrice: prices.length > 0 ? prices.reduce((a, b) => a + b, 0) / prices.length : 0,
            avgPricePerPiece: ppp.length > 0 ? ppp.reduce((a, b) => a + b, 0) / ppp.length : 0,
            avgPieceCount: pieces.length > 0 ? pieces.reduce((a, b) => a + b, 0) / pieces.length : 0,
            withAnalysis: items.filter((i) => i.listing_analysis && i.listing_analysis.length > 0).length,
          };
        })
        .sort((a, b) => a.date.localeCompare(b.date)),
    };

    // Analysis completion rate over time
    const analysisOverTime = {
      daily: Array.from(timeSeriesDaily.entries())
        .map(([date, items]) => {
          const withAnalysis = items.filter((i) => i.listing_analysis && i.listing_analysis.length > 0).length;
          return {
            date,
            total: items.length,
            withAnalysis,
            completionRate: items.length > 0 ? (withAnalysis / items.length) * 100 : 0,
          };
        })
        .sort((a, b) => a.date.localeCompare(b.date)),
      
      weekly: Array.from(timeSeriesWeekly.entries())
        .map(([date, items]) => {
          const withAnalysis = items.filter((i) => i.listing_analysis && i.listing_analysis.length > 0).length;
          return {
            date,
            total: items.length,
            withAnalysis,
            completionRate: items.length > 0 ? (withAnalysis / items.length) * 100 : 0,
          };
        })
        .sort((a, b) => a.date.localeCompare(b.date)),
      
      monthly: Array.from(timeSeriesMonthly.entries())
        .map(([date, items]) => {
          const withAnalysis = items.filter((i) => i.listing_analysis && i.listing_analysis.length > 0).length;
          return {
            date,
            total: items.length,
            withAnalysis,
            completionRate: items.length > 0 ? (withAnalysis / items.length) * 100 : 0,
          };
        })
        .sort((a, b) => a.date.localeCompare(b.date)),
    };

    // Status changes over time (stacked area chart)
    const statusOverTime = {
      daily: Array.from(timeSeriesDaily.entries())
        .map(([date, items]) => {
          const statusCounts = items.reduce((acc, item) => {
            const status = item.status || 'unknown';
            acc[status] = (acc[status] || 0) + 1;
            return acc;
          }, {} as Record<string, number>);
          return {
            date,
            ...statusCounts,
          };
        })
        .sort((a, b) => a.date.localeCompare(b.date)),
      
      weekly: Array.from(timeSeriesWeekly.entries())
        .map(([date, items]) => {
          const statusCounts = items.reduce((acc, item) => {
            const status = item.status || 'unknown';
            acc[status] = (acc[status] || 0) + 1;
            return acc;
          }, {} as Record<string, number>);
          return {
            date,
            ...statusCounts,
          };
        })
        .sort((a, b) => a.date.localeCompare(b.date)),
      
      monthly: Array.from(timeSeriesMonthly.entries())
        .map(([date, items]) => {
          const statusCounts = items.reduce((acc, item) => {
            const status = item.status || 'unknown';
            acc[status] = (acc[status] || 0) + 1;
            return acc;
          }, {} as Record<string, number>);
          return {
            date,
            ...statusCounts,
          };
        })
        .sort((a, b) => a.date.localeCompare(b.date)),
    };

    return NextResponse.json({
      basic: {
        totalListings,
        byStatus,
        byMarketplace,
        withAnalysis,
        withoutAnalysis,
        withPricePerPiece,
        withoutPricePerPiece,
      },
      priceDistribution: {
        bins: priceBins,
        minPrice,
        maxPrice,
      },
      attributeCoverage,
      pricePerPiece: {
        stats: pricePerPieceStats,
        distribution: bins,
        byCondition: pppByConditionStats,
        byMarketplace: pppByMarketplaceStats,
        estimated: {
          count: pppEstimated.length,
          mean: pppEstimated.length > 0 ? pppEstimated.reduce((a, b) => a + b, 0) / pppEstimated.length : 0,
          median: pppEstimated.length > 0 ? calculatePercentile([...pppEstimated].sort((a, b) => a - b), 50) : 0,
        },
        actual: {
          count: pppActual.length,
          mean: pppActual.length > 0 ? pppActual.reduce((a, b) => a + b, 0) / pppActual.length : 0,
          median: pppActual.length > 0 ? calculatePercentile([...pppActual].sort((a, b) => a - b), 50) : 0,
        },
      },
      marketplace: marketplaceStats,
      condition: conditionStats,
      pieceCount: {
        distribution: pieceBins,
        estimated: {
          count: estimatedPieceCounts.length,
          mean: estimatedPieceCounts.length > 0 ? estimatedPieceCounts.reduce((a, b) => a + b, 0) / estimatedPieceCounts.length : 0,
        },
        actual: {
          count: actualPieceCounts.length,
          mean: actualPieceCounts.length > 0 ? actualPieceCounts.reduce((a, b) => a + b, 0) / actualPieceCounts.length : 0,
        },
        vsPricePerPiece: pppVsPieces,
      },
      minifig: {
        distribution: minifigBins,
        byRange: pppByMinifigRange,
      },
      timeSeries: {
        listingsOverTime,
        analysisOverTime,
        statusOverTime,
      },
    });
  } catch (error) {
    console.error('Error aggregating listings:', error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'Unknown error occurred',
      },
      { status: 500 }
    );
  }
}

