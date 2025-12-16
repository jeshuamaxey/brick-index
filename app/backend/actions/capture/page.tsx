// Backend page for capture action

'use client';

import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

interface StatusData {
  lastCaptureJob: string | null;
  enrichment: {
    total: number;
    unenriched: number;
  };
  analysis: {
    total: number;
    unanalyzed: number;
  };
}

interface EbaySearchParams {
  entriesPerPage?: number;
  listingTypes?: string[];
  hideDuplicateItems?: boolean;
  categoryId?: string;
  marketplaceId?: string;
}

export default function CapturePage() {
  const [loadingAction, setLoadingAction] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<StatusData | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(true);

  // Form state
  const [keywords, setKeywords] = useState('lego bulk, lego job lot, lego lot');
  const [entriesPerPage, setEntriesPerPage] = useState('100');
  const [useEntriesPerPage, setUseEntriesPerPage] = useState(true);
  const [listingTypeFixed, setListingTypeFixed] = useState(true);
  const [listingTypeAuction, setListingTypeAuction] = useState(true);
  const [useListingTypes, setUseListingTypes] = useState(true);
  const [hideDuplicates, setHideDuplicates] = useState(true);
  const [useHideDuplicates, setUseHideDuplicates] = useState(true);
  const [categoryId, setCategoryId] = useState('220');
  const [useCategoryId, setUseCategoryId] = useState(true);
  const [marketplaceId, setMarketplaceId] = useState('');
  const [useMarketplaceId, setUseMarketplaceId] = useState(false);

  useEffect(() => {
    fetchStatus();
  }, []);

  const fetchStatus = async () => {
    try {
      setLoadingStatus(true);
      const response = await fetch('/api/backend/status');
      if (!response.ok) {
        throw new Error('Failed to fetch status');
      }
      const data = await response.json();
      setStatus(data);
    } catch (err) {
      console.error('Error fetching status:', err);
    } finally {
      setLoadingStatus(false);
    }
  };

  const formatDateTime = (dateString: string | null) => {
    if (!dateString) return null;
    try {
      const date = new Date(dateString);
      return date.toLocaleString();
    } catch {
      return null;
    }
  };

  const triggerCapture = async () => {
    try {
      setLoadingAction(true);
      setError(null);
      setResult(null);

      // Parse keywords
      const keywordArray = keywords
        .split(',')
        .map((k) => k.trim())
        .filter((k) => k.length > 0);

      if (keywordArray.length === 0) {
        throw new Error('At least one keyword is required');
      }

      // Build eBay params object
      const ebayParams: EbaySearchParams = {};

      if (useEntriesPerPage && entriesPerPage) {
        const entries = parseInt(entriesPerPage, 10);
        if (!isNaN(entries) && entries > 0) {
          ebayParams.entriesPerPage = entries;
        }
      }

      if (useListingTypes) {
        const types: string[] = [];
        if (listingTypeAuction) types.push('AuctionWithBIN');
        if (listingTypeFixed) types.push('FixedPrice');
        if (types.length > 0) {
          ebayParams.listingTypes = types;
        }
      }

      if (useHideDuplicates) {
        ebayParams.hideDuplicateItems = hideDuplicates;
      }

      if (useCategoryId && categoryId) {
        ebayParams.categoryId = categoryId;
      }

      if (useMarketplaceId && marketplaceId) {
        ebayParams.marketplaceId = marketplaceId;
      }

      const response = await fetch('/api/capture/trigger', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          marketplace: 'ebay',
          keywords: keywordArray,
          ebayParams: Object.keys(ebayParams).length > 0 ? ebayParams : undefined,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to trigger capture');
      }

      const data = await response.json();
      setResult(data);
      // Refresh status after action
      fetchStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoadingAction(false);
    }
  };

  const lastCaptureDate = status?.lastCaptureJob ? formatDateTime(status.lastCaptureJob) : null;

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-6">Capture</h1>

      <Card>
        <CardHeader>
          <CardTitle>Capture</CardTitle>
          <CardDescription>
            Searches for LEGO listings on eBay using keywords and stores them in the database. 
            Uses real eBay API if configured, or snapshot data in cache mode. Deduplicates listings 
            and updates existing ones.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {!loadingStatus && (
            <div className="text-sm text-muted-foreground">
              {lastCaptureDate 
                ? `Last successful capture job was completed on ${lastCaptureDate}.`
                : 'No successful capture jobs found.'}
            </div>
          )}

          <div className="space-y-4">
            {/* Keywords */}
            <div className="space-y-2">
              <Label htmlFor="keywords">Keywords (comma-separated)</Label>
              <Input
                id="keywords"
                type="text"
                value={keywords}
                onChange={(e) => setKeywords(e.target.value)}
                placeholder="lego bulk, lego job lot, lego lot"
              />
            </div>

            {/* Entries Per Page */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="useEntriesPerPage"
                  checked={useEntriesPerPage}
                  onChange={(e) => setUseEntriesPerPage(e.target.checked)}
                  className="rounded"
                />
                <Label htmlFor="useEntriesPerPage">Entries Per Page</Label>
              </div>
              {useEntriesPerPage && (
                <Input
                  type="number"
                  value={entriesPerPage}
                  onChange={(e) => setEntriesPerPage(e.target.value)}
                  min="1"
                  max="200"
                  placeholder="100"
                />
              )}
            </div>

            {/* Listing Types */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="useListingTypes"
                  checked={useListingTypes}
                  onChange={(e) => setUseListingTypes(e.target.checked)}
                  className="rounded"
                />
                <Label htmlFor="useListingTypes">Listing Types</Label>
              </div>
              {useListingTypes && (
                <div className="ml-6 space-y-2">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="listingTypeAuction"
                      checked={listingTypeAuction}
                      onChange={(e) => setListingTypeAuction(e.target.checked)}
                      className="rounded"
                    />
                    <Label htmlFor="listingTypeAuction">AuctionWithBIN</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="listingTypeFixed"
                      checked={listingTypeFixed}
                      onChange={(e) => setListingTypeFixed(e.target.checked)}
                      className="rounded"
                    />
                    <Label htmlFor="listingTypeFixed">FixedPrice</Label>
                  </div>
                </div>
              )}
            </div>

            {/* Hide Duplicates */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="useHideDuplicates"
                  checked={useHideDuplicates}
                  onChange={(e) => setUseHideDuplicates(e.target.checked)}
                  className="rounded"
                />
                <Label htmlFor="useHideDuplicates">Hide Duplicate Items</Label>
              </div>
              {useHideDuplicates && (
                <div className="ml-6">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="hideDuplicates"
                      checked={hideDuplicates}
                      onChange={(e) => setHideDuplicates(e.target.checked)}
                      className="rounded"
                    />
                    <Label htmlFor="hideDuplicates">Enabled</Label>
                  </div>
                </div>
              )}
            </div>

            {/* Category ID */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="useCategoryId"
                  checked={useCategoryId}
                  onChange={(e) => setUseCategoryId(e.target.checked)}
                  className="rounded"
                />
                <Label htmlFor="useCategoryId">Category ID</Label>
              </div>
              {useCategoryId && (
                <Input
                  type="text"
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  placeholder="220 (LEGO category)"
                />
              )}
            </div>

            {/* Marketplace ID */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="useMarketplaceId"
                  checked={useMarketplaceId}
                  onChange={(e) => setUseMarketplaceId(e.target.checked)}
                  className="rounded"
                />
                <Label htmlFor="useMarketplaceId">Marketplace ID</Label>
              </div>
              {useMarketplaceId && (
                <Input
                  type="text"
                  value={marketplaceId}
                  onChange={(e) => setMarketplaceId(e.target.value)}
                  placeholder="EBAY_US, EBAY_GB, etc."
                />
              )}
            </div>
          </div>
        </CardContent>
        <CardFooter>
          <Button
            onClick={triggerCapture}
            disabled={loadingAction}
            className="w-full"
          >
            {loadingAction ? 'Capturing...' : 'Trigger Capture'}
          </Button>
        </CardFooter>
      </Card>

      {error && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Error</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-destructive">{error}</p>
          </CardContent>
        </Card>
      )}

      {result && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Result</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="text-sm overflow-auto">
              {JSON.stringify(result, null, 2)}
            </pre>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
