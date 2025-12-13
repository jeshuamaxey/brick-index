// Dev page to view captured listings

'use client';

import { useEffect, useState } from 'react';
import DevNav from '../components/DevNav';

interface Listing {
  id: string;
  title: string;
  price: number | null;
  currency: string | null;
  url: string;
  marketplace: string;
  status: string;
  created_at: string;
  listing_analysis?: {
    piece_count: number | null;
    minifig_count: number | null;
    price_per_piece: number | null;
  }[];
}

export default function ListingsPage() {
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchListings();
  }, []);

  const fetchListings = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/listings/search?limit=100');
      if (!response.ok) {
        throw new Error('Failed to fetch listings');
      }
      const data = await response.json();
      setListings(data.listings || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="p-8">Loading listings...</div>;
  }

  if (error) {
    return <div className="p-8 text-red-600">Error: {error}</div>;
  }

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">Captured Listings</h1>
      <DevNav />
      <p className="mb-4 text-gray-600">
        Total: {listings.length} listings
      </p>
      <div className="space-y-4">
        {listings.map((listing) => {
          const analysis = listing.listing_analysis?.[0];
          return (
            <div
              key={listing.id}
              className="border rounded-lg p-4 hover:shadow-md transition-shadow"
            >
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <h2 className="text-lg font-semibold mb-2">
                    <a
                      href={listing.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline"
                    >
                      {listing.title}
                    </a>
                  </h2>
                  <div className="text-sm text-gray-600 space-y-1">
                    <div>
                      <strong>Price:</strong>{' '}
                      {listing.price
                        ? `${listing.currency || '$'}${listing.price.toFixed(2)}`
                        : 'N/A'}
                    </div>
                    <div>
                      <strong>Marketplace:</strong> {listing.marketplace}
                    </div>
                    <div>
                      <strong>Status:</strong> {listing.status}
                    </div>
                    {analysis && (
                      <>
                        <div>
                          <strong>Pieces:</strong>{' '}
                          {analysis.piece_count ?? 'Unknown'}
                        </div>
                        <div>
                          <strong>Minifigs:</strong>{' '}
                          {analysis.minifig_count ?? 'Unknown'}
                        </div>
                        <div>
                          <strong>Price per piece:</strong>{' '}
                          {analysis.price_per_piece
                            ? `$${analysis.price_per_piece.toFixed(4)}`
                            : 'N/A'}
                        </div>
                      </>
                    )}
                    <div>
                      <strong>Captured:</strong>{' '}
                      {new Date(listing.created_at).toLocaleString()}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

