// Dev page to seed test data

'use client';

import { useState } from 'react';
import DevNav from '../components/DevNav';

export default function SeedPage() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const seedData = async (action: string) => {
    try {
      setLoading(true);
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
      setLoading(false);
    }
  };

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">Seed Test Data</h1>
      <DevNav />
      <p className="mb-4 text-gray-600">
        Use this page to populate the database with mock LEGO listings when you
        don't have eBay API access yet.
      </p>

      <div className="space-y-4">
        <div>
          <button
            onClick={() => seedData('listings')}
            disabled={loading}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed mr-2"
          >
            {loading ? 'Seeding...' : 'Seed Listings Only'}
          </button>
          <button
            onClick={() => seedData('analyze')}
            disabled={loading}
            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed mr-2"
          >
            {loading ? 'Analyzing...' : 'Analyze Existing Listings'}
          </button>
          <button
            onClick={() => seedData('all')}
            disabled={loading}
            className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Seeding All...' : 'Seed Everything'}
          </button>
        </div>

        {error && (
          <div className="p-4 bg-red-100 text-red-700 rounded">
            Error: {error}
          </div>
        )}

        {result && (
          <div className="p-4 bg-green-100 text-green-700 rounded">
            <h2 className="font-semibold mb-2">Success!</h2>
            <pre className="text-sm overflow-auto">
              {JSON.stringify(result, null, 2)}
            </pre>
          </div>
        )}
      </div>

      <div className="mt-8 p-4 bg-gray-100 rounded">
        <h2 className="font-semibold mb-2">What This Does:</h2>
        <ul className="list-disc list-inside space-y-1 text-sm">
          <li>
            <strong>Seed Listings:</strong> Creates 5 mock LEGO listings using
            the mock adapter (no eBay API needed)
          </li>
          <li>
            <strong>Analyze:</strong> Analyzes all existing listings to extract
            piece count, minifigs, and calculate price per piece
          </li>
          <li>
            <strong>Seed Everything:</strong> Does both - creates listings and
            analyzes them
          </li>
        </ul>
      </div>
    </div>
  );
}

