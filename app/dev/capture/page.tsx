// Dev page to trigger and manage capture jobs

'use client';

import { useState } from 'react';
import DevNav from '../components/DevNav';

interface Job {
  id: string;
  type: string;
  marketplace: string;
  status: 'running' | 'completed' | 'failed';
  listings_found: number;
  listings_new: number;
  listings_updated: number;
  started_at: string;
  completed_at: string | null;
  error_message: string | null;
  metadata?: Record<string, unknown>;
}

interface EbaySearchParams {
  entriesPerPage?: number;
  listingTypes?: string[];
  hideDuplicateItems?: boolean;
  categoryId?: string;
}

export default function CapturePage() {
  const [loading, setLoading] = useState(false);
  const [job, setJob] = useState<Job | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Form state with default values (current hardcoded values)
  const [keywords, setKeywords] = useState('lego bulk, lego job lot, lego lot');
  const [entriesPerPage, setEntriesPerPage] = useState('100');
  const [useEntriesPerPage, setUseEntriesPerPage] = useState(true);
  
  const [listingTypeAuction, setListingTypeAuction] = useState(true);
  const [listingTypeFixed, setListingTypeFixed] = useState(true);
  const [useListingTypes, setUseListingTypes] = useState(true);
  
  const [hideDuplicates, setHideDuplicates] = useState(true);
  const [useHideDuplicates, setUseHideDuplicates] = useState(true);
  
  const [categoryId, setCategoryId] = useState('220');
  const [useCategoryId, setUseCategoryId] = useState(true);

  const triggerCapture = async () => {
    try {
      setLoading(true);
      setError(null);

      // Parse keywords
      const keywordArray = keywords
        .split(',')
        .map((k) => k.trim())
        .filter((k) => k.length > 0);

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
      setJob(data);

      // Poll for status updates
      if (data.status === 'running') {
        pollJobStatus(data.id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const pollJobStatus = async (jobId: string) => {
    const maxAttempts = 60; // 5 minutes max
    let attempts = 0;

    const interval = setInterval(async () => {
      attempts++;
      try {
        const response = await fetch(`/api/capture/status/${jobId}`);
        if (response.ok) {
          const data = await response.json();
          setJob(data);

          if (data.status !== 'running' || attempts >= maxAttempts) {
            clearInterval(interval);
          }
        }
      } catch (err) {
        console.error('Error polling job status:', err);
        clearInterval(interval);
      }
    }, 5000); // Poll every 5 seconds
  };

  return (
    <div className="p-8 bg-background text-foreground">
      <h1 className="text-2xl font-bold mb-4">Capture Jobs</h1>
      <DevNav />

      <div className="mb-6 p-4 bg-background border border-foreground/10 rounded-lg">
        <h2 className="text-lg font-semibold mb-2 text-foreground">What does "Trigger Capture" do?</h2>
        <ul className="list-disc list-inside space-y-2 text-sm text-foreground">
          <li>
            <strong>Searches for LEGO listings</strong> on eBay using keywords: "lego bulk", "lego job lot", "lego lot"
          </li>
          <li>
            <strong>Uses mock data</strong> if <code className="bg-foreground/10 px-1 rounded text-foreground">EBAY_APP_ID</code> is not set, or{' '}
            <strong>real eBay API</strong> if you have an App ID configured
          </li>
          <li>
            <strong>Stores raw API responses</strong> in the <code className="bg-foreground/10 px-1 rounded text-foreground">raw_listings</code> table
          </li>
          <li>
            <strong>Transforms data</strong> into structured listings in the <code className="bg-foreground/10 px-1 rounded text-foreground">listings</code> table
          </li>
          <li>
            <strong>Deduplicates</strong> listings to avoid storing the same listing twice
          </li>
          <li>
            <strong>Updates existing listings</strong> if they were seen before (updates <code className="bg-foreground/10 px-1 rounded text-foreground">last_seen_at</code>)
          </li>
        </ul>
        <p className="mt-3 text-sm text-foreground/70">
          After capture completes, you can analyze the listings at <code className="bg-foreground/10 px-1 rounded text-foreground">/dev/analysis</code> or use the seed page to automatically capture and analyze.
        </p>
      </div>

      <div className="mt-6 p-6 bg-background border border-foreground/10 rounded-lg">
        <h2 className="text-lg font-semibold mb-4">Search Configuration</h2>

        <div className="space-y-4">
          {/* Keywords */}
          <div>
            <label className="block text-sm font-medium mb-1 text-foreground">
              Keywords (comma-separated)
            </label>
            <input
              type="text"
              value={keywords}
              onChange={(e) => setKeywords(e.target.value)}
              className="w-full px-3 py-2 border border-foreground/20 rounded bg-background text-foreground"
              placeholder="lego bulk, lego job lot, lego lot"
            />
          </div>

          {/* Entries Per Page */}
          <div>
            <div className="flex items-center gap-2 mb-1">
              <input
                type="checkbox"
                checked={useEntriesPerPage}
                onChange={(e) => setUseEntriesPerPage(e.target.checked)}
                className="rounded"
              />
              <label className="text-sm font-medium text-foreground">
                Entries Per Page
              </label>
            </div>
            {useEntriesPerPage && (
              <input
                type="number"
                value={entriesPerPage}
                onChange={(e) => setEntriesPerPage(e.target.value)}
                className="w-full px-3 py-2 border border-foreground/20 rounded bg-background text-foreground"
                min="1"
                max="100"
              />
            )}
          </div>

          {/* Listing Types */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <input
                type="checkbox"
                checked={useListingTypes}
                onChange={(e) => setUseListingTypes(e.target.checked)}
                className="rounded"
              />
              <label className="text-sm font-medium text-foreground">Listing Types</label>
            </div>
            {useListingTypes && (
              <div className="ml-6 space-y-2">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={listingTypeAuction}
                    onChange={(e) => setListingTypeAuction(e.target.checked)}
                    className="rounded"
                  />
                  <span className="text-sm text-foreground">AuctionWithBIN</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={listingTypeFixed}
                    onChange={(e) => setListingTypeFixed(e.target.checked)}
                    className="rounded"
                  />
                  <span className="text-sm text-foreground">FixedPrice</span>
                </label>
              </div>
            )}
          </div>

          {/* Hide Duplicates */}
          <div>
            <div className="flex items-center gap-2 mb-1">
              <input
                type="checkbox"
                checked={useHideDuplicates}
                onChange={(e) => setUseHideDuplicates(e.target.checked)}
                className="rounded"
              />
              <label className="text-sm font-medium text-foreground">Hide Duplicate Items</label>
            </div>
            {useHideDuplicates && (
              <label className="flex items-center gap-2 ml-6">
                <input
                  type="checkbox"
                  checked={hideDuplicates}
                  onChange={(e) => setHideDuplicates(e.target.checked)}
                  className="rounded"
                />
                <span className="text-sm text-foreground">Enabled</span>
              </label>
            )}
          </div>

          {/* Category ID */}
          <div>
            <div className="flex items-center gap-2 mb-1">
              <input
                type="checkbox"
                checked={useCategoryId}
                onChange={(e) => setUseCategoryId(e.target.checked)}
                className="rounded"
              />
              <label className="text-sm font-medium text-foreground">Category ID</label>
            </div>
            {useCategoryId && (
              <input
                type="text"
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="w-full px-3 py-2 border border-foreground/20 rounded bg-background text-foreground"
                placeholder="220 (LEGO category)"
              />
            )}
          </div>
        </div>

        <button
          onClick={triggerCapture}
          disabled={loading}
          className="mt-6 px-4 py-2 bg-foreground text-background rounded hover:bg-foreground/90 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Triggering...' : 'Trigger Capture'}
        </button>
      </div>

      {error && (
        <div className="mt-4 p-4 bg-foreground/10 border border-foreground/20 rounded text-foreground">
          Error: {error}
        </div>
      )}

      {job && (
        <div className="mt-6 bg-background border border-foreground/10 rounded-lg p-4">
          <h2 className="text-lg font-semibold mb-2 text-foreground">Job Status</h2>
          <div className="space-y-2 text-sm text-foreground">
            <div>
              <strong>ID:</strong> {job.id}
            </div>
            <div>
              <strong>Marketplace:</strong> {job.marketplace}
            </div>
            <div>
              <strong>Status:</strong>{' '}
              <span className="text-foreground">
                {job.status}
              </span>
            </div>
            <div>
              <strong>Listings Found:</strong> {job.listings_found}
            </div>
            <div>
              <strong>New Listings:</strong> {job.listings_new}
            </div>
            <div>
              <strong>Updated Listings:</strong> {job.listings_updated}
            </div>
            <div>
              <strong>Started:</strong>{' '}
              {new Date(job.started_at).toLocaleString()}
            </div>
            {job.completed_at && (
              <div>
                <strong>Completed:</strong>{' '}
                {new Date(job.completed_at).toLocaleString()}
              </div>
            )}
            {job.error_message && (
              <div className="text-foreground">
                <strong>Error:</strong> {job.error_message}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

