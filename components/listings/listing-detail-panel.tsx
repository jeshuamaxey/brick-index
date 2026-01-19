'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { ExternalLink } from 'lucide-react';

interface ListingDetail {
  id: string;
  title: string;
  description: string | null;
  sanitised_title: string | null;
  sanitised_description: string | null;
  price: number | null;
  currency: string | null;
  url: string;
  marketplace: string;
  status: string;
  created_at: string;
  updated_at: string;
  first_seen_at: string;
  last_seen_at: string;
  image_urls: string[] | null;
  additional_images: string[] | null;
  location: string | null;
  seller_name: string | null;
  seller_rating: number | null;
  condition_description: string | null;
  category_path: string | null;
  item_location: Record<string, unknown> | null;
  estimated_availabilities: Record<string, unknown> | null;
  buying_options: string[] | null;
  enriched_at: string | null;
  job_id: string | null;
}

interface ListingAnalysis {
  id: string;
  listing_id: string;
  piece_count: number | null;
  estimated_piece_count: boolean;
  minifig_count: number | null;
  estimated_minifig_count: boolean;
  condition: string;
  price_per_piece: number | null;
  analysis_metadata: Record<string, unknown> | null;
  analyzed_at: string;
  analysis_version: string;
}

interface ListingDetailPanelProps {
  listingId: string;
}

export function ListingDetailPanel({ listingId }: ListingDetailPanelProps) {
  const [listing, setListing] = useState<ListingDetail | null>(null);
  const [analysis, setAnalysis] = useState<ListingAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showSanitized, setShowSanitized] = useState(true);

  useEffect(() => {
    const fetchListing = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await fetch(`/api/listings/${listingId}`);
        if (!response.ok) {
          throw new Error('Failed to fetch listing details');
        }
        const data = await response.json();
        setListing(data.listing);
        setAnalysis(data.analysis);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    fetchListing();
  }, [listingId]);

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A';
    try {
      return new Date(dateString).toLocaleString();
    } catch {
      return dateString;
    }
  };

  const formatPrice = (price: number | null, currency: string | null) => {
    if (price === null) return 'N/A';
    return `${currency || '$'}${price.toFixed(2)}`;
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-500/20 text-green-700 dark:text-green-400 border border-green-500/30';
      case 'sold':
        return 'bg-blue-500/20 text-blue-700 dark:text-blue-400 border border-blue-500/30';
      case 'expired':
        return 'bg-gray-500/20 text-gray-700 dark:text-gray-400 border border-gray-500/30';
      case 'removed':
        return 'bg-red-500/20 text-red-700 dark:text-red-400 border border-red-500/30';
      default:
        return 'bg-foreground/10 text-foreground border border-foreground/20';
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (error || !listing) {
    return (
      <div className="bg-destructive/10 border border-destructive/20 text-destructive px-4 py-3 rounded">
        Error: {error || 'Listing not found'}
      </div>
    );
  }

  const allImages = [
    ...(listing.image_urls || []),
    ...(listing.additional_images || []),
  ].filter(Boolean);

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <div className="space-y-4">
        {/* Basic Information */}
        <Card>
          <CardHeader>
            <CardTitle>Basic Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {(() => {
              // Determine if we should show toggle (both sanitized and unsanitized exist)
              const hasSanitizedTitle = listing.sanitised_title !== null && listing.sanitised_title.trim() !== '';
              const hasSanitizedDescription = listing.sanitised_description !== null && listing.sanitised_description.trim() !== '';
              const hasTitle = listing.title !== null && listing.title.trim() !== '';
              const hasDescription = listing.description !== null && listing.description.trim() !== '';
              const showToggle = (hasSanitizedTitle && hasTitle) || (hasSanitizedDescription && hasDescription);

              // Get display values (sanitized by default, fallback to regular)
              const displayTitle = showSanitized && hasSanitizedTitle
                ? listing.sanitised_title
                : listing.title;
              const displayDescription = showSanitized && hasSanitizedDescription
                ? listing.sanitised_description
                : listing.description;

              return (
                <>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <Label className="text-sm font-medium">Title</Label>
                      {showToggle && (
                        <button
                          onClick={() => setShowSanitized(!showSanitized)}
                          className="text-xs text-primary hover:underline"
                          type="button"
                        >
                          {showSanitized ? 'Show Original' : 'Show Sanitized'}
                        </button>
                      )}
                    </div>
                    <p className="text-sm text-foreground">{displayTitle || 'N/A'}</p>
                  </div>
                  <Separator />
                  {(displayDescription || listing.description) && (
                    <>
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <Label className="text-sm font-medium">Description</Label>
                        </div>
                        <p className="text-sm text-foreground/80 whitespace-pre-wrap">
                          {displayDescription || listing.description || 'N/A'}
                        </p>
                      </div>
                      <Separator />
                    </>
                  )}
                </>
              );
            })()}
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">Price</Label>
              <span className="text-sm font-semibold text-foreground">
                {formatPrice(listing.price, listing.currency)}
              </span>
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">Marketplace</Label>
              <span className="text-sm text-foreground">{listing.marketplace}</span>
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">Status</Label>
              <span
                className={`px-2 py-1 rounded text-xs font-medium ${getStatusBadgeClass(
                  listing.status
                )}`}
              >
                {listing.status}
              </span>
            </div>
            <Separator />
            <div>
              <Label className="text-sm font-medium mb-1 block">URL</Label>
              <a
                href={listing.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-primary hover:underline flex items-center gap-1"
              >
                View on {listing.marketplace}
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </CardContent>
        </Card>

        {/* Images */}
        {allImages.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Images</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-2">
                {allImages.slice(0, 6).map((url, index) => (
                  <img
                    key={index}
                    src={url}
                    alt={`Listing image ${index + 1}`}
                    className="w-full h-32 object-cover rounded border border-foreground/10"
                  />
                ))}
              </div>
              {allImages.length > 6 && (
                <p className="text-xs text-foreground/60 mt-2">
                  +{allImages.length - 6} more images
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {/* Seller Information */}
        {(listing.seller_name || listing.seller_rating !== null) && (
          <Card>
            <CardHeader>
              <CardTitle>Seller Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {listing.seller_name && (
                <>
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-medium">Seller Name</Label>
                    <span className="text-sm text-foreground">{listing.seller_name}</span>
                  </div>
                  {listing.seller_rating !== null && <Separator />}
                </>
              )}
              {listing.seller_rating !== null && (
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium">Seller Rating</Label>
                  <span className="text-sm text-foreground">
                    {listing.seller_rating.toFixed(1)}
                  </span>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Location */}
        {listing.location && (
          <Card>
            <CardHeader>
              <CardTitle>Location</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-foreground">{listing.location}</p>
              {listing.item_location && (
                <div className="mt-2 text-xs text-foreground/70">
                  <pre className="bg-foreground/5 rounded p-2 overflow-x-auto">
                    {JSON.stringify(listing.item_location, null, 2)}
                  </pre>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Condition & Category */}
        {(listing.condition_description || listing.category_path) && (
          <Card>
            <CardHeader>
              <CardTitle>Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {listing.condition_description && (
                <>
                  <div>
                    <Label className="text-sm font-medium mb-1 block">Condition</Label>
                    <p className="text-sm text-foreground/80">{listing.condition_description}</p>
                  </div>
                  {listing.category_path && <Separator />}
                </>
              )}
              {listing.category_path && (
                <div>
                  <Label className="text-sm font-medium mb-1 block">Category</Label>
                  <p className="text-sm text-foreground/80">{listing.category_path}</p>
                </div>
              )}
              {listing.buying_options && listing.buying_options.length > 0 && (
                <>
                  {listing.condition_description || listing.category_path ? <Separator /> : null}
                  <div>
                    <Label className="text-sm font-medium mb-1 block">Buying Options</Label>
                    <div className="flex flex-wrap gap-2">
                      {listing.buying_options.map((option, index) => (
                        <span
                          key={index}
                          className="px-2 py-1 rounded text-xs bg-foreground/10 text-foreground"
                        >
                          {option}
                        </span>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        )}

        {/* Analysis */}
        {analysis && (
          <Card>
            <CardHeader>
              <CardTitle>Analysis</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {analysis.piece_count !== null && (
                <>
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-medium">
                      Piece Count
                      {analysis.estimated_piece_count && (
                        <span className="text-xs text-foreground/60 ml-1">(estimated)</span>
                      )}
                    </Label>
                    <span className="text-sm font-semibold text-foreground">
                      {analysis.piece_count.toLocaleString()}
                    </span>
                  </div>
                  <Separator />
                </>
              )}
              {analysis.minifig_count !== null && (
                <>
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-medium">
                      Minifig Count
                      {analysis.estimated_minifig_count && (
                        <span className="text-xs text-foreground/60 ml-1">(estimated)</span>
                      )}
                    </Label>
                    <span className="text-sm font-semibold text-foreground">
                      {analysis.minifig_count}
                    </span>
                  </div>
                  <Separator />
                </>
              )}
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">Condition</Label>
                <span className="text-sm text-foreground capitalize">{analysis.condition}</span>
              </div>
              {analysis.price_per_piece !== null && (
                <>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-medium">Price Per Piece</Label>
                    <span className="text-sm font-semibold text-foreground">
                      ${analysis.price_per_piece.toFixed(4)}
                    </span>
                  </div>
                </>
              )}
              <Separator />
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">Analysis Version</Label>
                <span className="text-sm text-foreground/70">{analysis.analysis_version}</span>
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">Analyzed At</Label>
                <span className="text-sm text-foreground/70">{formatDate(analysis.analyzed_at)}</span>
              </div>
              {analysis.analysis_metadata &&
                Object.keys(analysis.analysis_metadata).length > 0 && (
                  <>
                    <Separator />
                    <div>
                      <Label className="text-sm font-medium mb-1 block">Analysis Metadata</Label>
                      <pre className="text-xs bg-foreground/5 rounded p-2 overflow-x-auto">
                        {JSON.stringify(analysis.analysis_metadata, null, 2)}
                      </pre>
                    </div>
                  </>
                )}
            </CardContent>
          </Card>
        )}

        {/* Timestamps */}
        <Card>
          <CardHeader>
            <CardTitle>Timestamps</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">Created At</Label>
              <span className="text-sm text-foreground/70">{formatDate(listing.created_at)}</span>
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">Updated At</Label>
              <span className="text-sm text-foreground/70">{formatDate(listing.updated_at)}</span>
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">First Seen</Label>
              <span className="text-sm text-foreground/70">
                {formatDate(listing.first_seen_at)}
              </span>
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">Last Seen</Label>
              <span className="text-sm text-foreground/70">
                {formatDate(listing.last_seen_at)}
              </span>
            </div>
            {listing.enriched_at && (
              <>
                <Separator />
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium">Enriched At</Label>
                  <span className="text-sm text-foreground/70">
                    {formatDate(listing.enriched_at)}
                  </span>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
