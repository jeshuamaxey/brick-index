// Backend page for capture action

'use client';

import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import type { EbaySearchParams } from '@/lib/capture/marketplace-adapters/ebay-adapter';

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

export default function CapturePage() {
  const [loadingAction, setLoadingAction] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<StatusData | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(true);

  // Form state
  const [keywords, setKeywords] = useState('');
  const [entriesPerPage, setEntriesPerPage] = useState('200');
  const [useEntriesPerPage, setUseEntriesPerPage] = useState(true);
  const [enablePagination, setEnablePagination] = useState(true);
  const [maxResults, setMaxResults] = useState('10000');
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

      // Add pagination parameters
      ebayParams.enablePagination = enablePagination;
      if (enablePagination && maxResults) {
        const max = parseInt(maxResults, 10);
        if (!isNaN(max) && max > 0 && max <= 10000) {
          ebayParams.maxResults = max;
        }
      }

      // Always use EXTENDED fieldgroups for maximum data
      ebayParams.fieldgroups = 'EXTENDED';

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

  // Generate JSON payload for Inngest
  const generateInngestPayload = () => {
    const keywordArray = keywords
      .split(',')
      .map((k) => k.trim())
      .filter((k) => k.length > 0);

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

    ebayParams.enablePagination = enablePagination;
    if (enablePagination && maxResults) {
      const max = parseInt(maxResults, 10);
      if (!isNaN(max) && max > 0 && max <= 10000) {
        ebayParams.maxResults = max;
      }
    }

    ebayParams.fieldgroups = 'EXTENDED';

    const payload = {
      name: 'job/capture.triggered',
      data: {
        marketplace: 'ebay',
        keywords: keywordArray.length > 0 ? keywordArray : [],
        ...(Object.keys(ebayParams).length > 0 && { ebayParams }),
      },
    };

    return payload;
  };

  return (
    <div className="p-8 bg-background">
      <h1 className="text-2xl font-bold mb-6 text-foreground">Capture</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
              <Label htmlFor="keywords">Keywords (comma-separated) *</Label>
              <Input
                id="keywords"
                type="text"
                value={keywords}
                onChange={(e) => setKeywords(e.target.value)}
                placeholder="lego bulk, lego job lot, lego lot"
                required
              />
              <p className="text-xs text-muted-foreground">
                Required. Enter one or more keywords separated by commas.
              </p>
            </div>

            {/* Entries Per Page */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="useEntriesPerPage"
                  checked={useEntriesPerPage}
                  onCheckedChange={(checked) => setUseEntriesPerPage(checked === true)}
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
                  placeholder="200"
                />
              )}
            </div>

            {/* Enable Pagination */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="enablePagination"
                  checked={enablePagination}
                  onCheckedChange={(checked) => setEnablePagination(checked === true)}
                />
                <Label htmlFor="enablePagination">Enable Pagination</Label>
              </div>
              {enablePagination && (
                <div className="ml-6 space-y-2">
                  <Label htmlFor="maxResults">Max Results (1-10000)</Label>
                  <Input
                    id="maxResults"
                    type="number"
                    value={maxResults}
                    onChange={(e) => setMaxResults(e.target.value)}
                    min="1"
                    max="10000"
                    placeholder="10000"
                  />
                </div>
              )}
            </div>

            {/* Listing Types */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="useListingTypes"
                  checked={useListingTypes}
                  onCheckedChange={(checked) => setUseListingTypes(checked === true)}
                />
                <Label htmlFor="useListingTypes">Listing Types</Label>
              </div>
              {useListingTypes && (
                <div className="ml-6 space-y-2">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="listingTypeAuction"
                      checked={listingTypeAuction}
                      onCheckedChange={(checked) => setListingTypeAuction(checked === true)}
                    />
                    <Label htmlFor="listingTypeAuction">AuctionWithBIN</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="listingTypeFixed"
                      checked={listingTypeFixed}
                      onCheckedChange={(checked) => setListingTypeFixed(checked === true)}
                    />
                    <Label htmlFor="listingTypeFixed">FixedPrice</Label>
                  </div>
                </div>
              )}
            </div>

            {/* Hide Duplicates */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="useHideDuplicates"
                  checked={useHideDuplicates}
                  onCheckedChange={(checked) => setUseHideDuplicates(checked === true)}
                />
                <Label htmlFor="useHideDuplicates">Hide Duplicate Items</Label>
              </div>
              {useHideDuplicates && (
                <div className="ml-6">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="hideDuplicates"
                      checked={hideDuplicates}
                      onCheckedChange={(checked) => setHideDuplicates(checked === true)}
                    />
                    <Label htmlFor="hideDuplicates">Enabled</Label>
                  </div>
                </div>
              )}
            </div>

            {/* Category ID */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="useCategoryId"
                  checked={useCategoryId}
                  onCheckedChange={(checked) => setUseCategoryId(checked === true)}
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
                <Checkbox
                  id="useMarketplaceId"
                  checked={useMarketplaceId}
                  onCheckedChange={(checked) => setUseMarketplaceId(checked === true)}
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
            disabled={loadingAction || !keywords.trim()}
            className="w-full"
          >
            {loadingAction ? 'Capturing...' : 'Trigger Capture'}
          </Button>
        </CardFooter>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Inngest Event Payload</CardTitle>
          <CardDescription>
            Copy this JSON to paste into Inngest's event trigger. Use the <code>data</code> field value.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <pre className="text-xs bg-muted p-4 rounded-md overflow-auto max-h-[600px]">
            {JSON.stringify(generateInngestPayload(), null, 2)}
          </pre>
        </CardContent>
        <CardFooter>
          <Button
            variant="outline"
            onClick={() => {
              navigator.clipboard.writeText(JSON.stringify(generateInngestPayload().data, null, 2));
            }}
            className="w-full"
          >
            Copy Data Field
          </Button>
        </CardFooter>
      </Card>
      </div>

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
            <pre className="text-sm text-foreground overflow-auto">
              {JSON.stringify(result, null, 2)}
            </pre>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
