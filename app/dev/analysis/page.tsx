// Dev page to view analysis results

'use client';

import { useEffect, useState } from 'react';
import DevNav from '../components/DevNav';

interface Analysis {
  id: string;
  listing_id: string;
  piece_count: number | null;
  estimated_piece_count: boolean;
  minifig_count: number | null;
  estimated_minifig_count: boolean;
  condition: string;
  price_per_piece: number | null;
  analyzed_at: string;
}

export default function AnalysisPage() {
  const [analyses, setAnalyses] = useState<Analysis[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchAnalyses();
  }, []);

  const fetchAnalyses = async () => {
    try {
      setLoading(true);
      // Fetch listings with analysis
      const response = await fetch('/api/listings/search?limit=100');
      if (!response.ok) {
        throw new Error('Failed to fetch analyses');
      }
      const data = await response.json();
      const analysesWithData = data.listings
        .filter((l: any) => l.listing_analysis && l.listing_analysis.length > 0)
        .map((l: any) => l.listing_analysis[0]);
      setAnalyses(analysesWithData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="p-8 bg-background text-foreground">Loading analyses...</div>;
  }

  if (error) {
    return <div className="p-8 bg-background text-foreground">Error: {error}</div>;
  }

  return (
    <div className="p-8 bg-background text-foreground">
      <h1 className="text-2xl font-bold mb-4">Analysis Results</h1>
      <DevNav />
      <p className="mb-4 text-foreground/70">
        Total: {analyses.length} analyzed listings
      </p>
      <div className="space-y-4">
        {analyses.map((analysis) => (
          <div
            key={analysis.id}
            className="bg-background border border-foreground/10 rounded-lg p-4 hover:shadow-md transition-shadow"
          >
            <div className="space-y-2 text-sm text-foreground">
              <div>
                <strong>Listing ID:</strong> {analysis.listing_id}
              </div>
              <div>
                <strong>Pieces:</strong>{' '}
                {analysis.piece_count ?? 'Unknown'}{' '}
                {analysis.estimated_piece_count && (
                  <span className="text-foreground/70">(estimated)</span>
                )}
              </div>
              <div>
                <strong>Minifigs:</strong>{' '}
                {analysis.minifig_count ?? 'Unknown'}{' '}
                {analysis.estimated_minifig_count && (
                  <span className="text-foreground/70">(estimated)</span>
                )}
              </div>
              <div>
                <strong>Condition:</strong> {analysis.condition}
              </div>
              <div>
                <strong>Price per piece:</strong>{' '}
                {analysis.price_per_piece
                  ? `$${analysis.price_per_piece.toFixed(4)}`
                  : 'N/A'}
              </div>
              <div>
                <strong>Analyzed:</strong>{' '}
                {new Date(analysis.analyzed_at).toLocaleString()}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

