// Dev page to seed test data

'use client';

import { useState } from 'react';
import DevNav from '../components/DevNav';

export default function SeedPage() {
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const seedData = async (action: string) => {
    try {
      setLoadingAction(action);
      setError(null);
      const response = await fetch('/api/dev/seed', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to seed data');
      }

      const data = await response.json();
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoadingAction(null);
    }
  };

  return (
    <div className="p-8 bg-background text-foreground">
      <h1 className="text-2xl font-bold mb-4">Seed Test Data</h1>
      <DevNav />

      <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-background border border-foreground/10 rounded-lg p-6">
          <h2 className="text-lg font-semibold mb-2 text-foreground">Seed Listings</h2>
          <p className="text-sm text-foreground/70 mb-4">
            Creates mock LEGO listings using the mock adapter. This does not require an eBay API key and is useful for development and testing. The mock adapter will generate sample listings that can be used to test the analysis pipeline.
          </p>
          <button
            onClick={() => seedData('listings')}
            disabled={loadingAction !== null}
            className="w-full px-4 py-2 bg-foreground text-background rounded hover:bg-foreground/90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loadingAction === 'listings' ? 'Seeding...' : 'Seed Listings'}
          </button>
        </div>

        <div className="bg-background border border-foreground/10 rounded-lg p-6">
          <h2 className="text-lg font-semibold mb-2 text-foreground">Analyze Listings</h2>
          <p className="text-sm text-foreground/70 mb-4">
            Analyzes all existing listings that don't have analysis yet. This extracts piece count, minifig count, condition, and calculates price per piece from listing titles and descriptions. Up to 100 listings will be analyzed per run.
          </p>
          <button
            onClick={() => seedData('analyze')}
            disabled={loadingAction !== null}
            className="w-full px-4 py-2 bg-foreground text-background rounded hover:bg-foreground/90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loadingAction === 'analyze' ? 'Analyzing...' : 'Analyze Listings'}
          </button>
        </div>
      </div>

      {error && (
        <div className="mt-4 p-4 bg-foreground/10 border border-foreground/20 rounded text-foreground">
          Error: {error}
        </div>
      )}

      {result && (
        <div className="mt-4 p-4 bg-foreground/10 border border-foreground/20 rounded text-foreground">
          <h2 className="font-semibold mb-2">Success!</h2>
          <pre className="text-sm overflow-auto text-foreground">
            {JSON.stringify(result, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

