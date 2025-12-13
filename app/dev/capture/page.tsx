// Dev page to trigger and manage capture jobs

'use client';

import { useState } from 'react';
import DevNav from '../components/DevNav';

interface CaptureJob {
  id: string;
  marketplace: string;
  status: string;
  listings_found: number;
  listings_new: number;
  listings_updated: number;
  started_at: string;
  completed_at: string | null;
  error_message: string | null;
}

export default function CapturePage() {
  const [loading, setLoading] = useState(false);
  const [job, setJob] = useState<CaptureJob | null>(null);
  const [error, setError] = useState<string | null>(null);

  const triggerCapture = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch('/api/capture/trigger', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          marketplace: 'ebay',
          keywords: ['lego bulk', 'lego job lot', 'lego lot'],
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
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">Capture Jobs</h1>
      <DevNav />

      <div className="mb-6 p-4 bg-gray-50 rounded-lg border">
        <h2 className="text-lg font-semibold mb-2">What does "Trigger Capture" do?</h2>
        <ul className="list-disc list-inside space-y-2 text-sm text-gray-700">
          <li>
            <strong>Searches for LEGO listings</strong> on eBay using keywords: "lego bulk", "lego job lot", "lego lot"
          </li>
          <li>
            <strong>Uses mock data</strong> if <code className="bg-gray-200 px-1 rounded">EBAY_APP_ID</code> is not set, or{' '}
            <strong>real eBay API</strong> if you have an App ID configured
          </li>
          <li>
            <strong>Stores raw API responses</strong> in the <code className="bg-gray-200 px-1 rounded">raw_listings</code> table
          </li>
          <li>
            <strong>Transforms data</strong> into structured listings in the <code className="bg-gray-200 px-1 rounded">listings</code> table
          </li>
          <li>
            <strong>Deduplicates</strong> listings to avoid storing the same listing twice
          </li>
          <li>
            <strong>Updates existing listings</strong> if they were seen before (updates <code className="bg-gray-200 px-1 rounded">last_seen_at</code>)
          </li>
        </ul>
        <p className="mt-3 text-sm text-gray-600">
          After capture completes, you can analyze the listings at <code className="bg-gray-200 px-1 rounded">/dev/analysis</code> or use the seed page to automatically capture and analyze.
        </p>
      </div>

      <button
        onClick={triggerCapture}
        disabled={loading}
        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? 'Triggering...' : 'Trigger Capture'}
      </button>

      {error && (
        <div className="mt-4 p-4 bg-red-100 text-red-700 rounded">
          Error: {error}
        </div>
      )}

      {job && (
        <div className="mt-6 border rounded-lg p-4">
          <h2 className="text-lg font-semibold mb-2">Job Status</h2>
          <div className="space-y-2 text-sm">
            <div>
              <strong>ID:</strong> {job.id}
            </div>
            <div>
              <strong>Marketplace:</strong> {job.marketplace}
            </div>
            <div>
              <strong>Status:</strong>{' '}
              <span
                className={
                  job.status === 'completed'
                    ? 'text-green-600'
                    : job.status === 'failed'
                      ? 'text-red-600'
                      : 'text-yellow-600'
                }
              >
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
              <div className="text-red-600">
                <strong>Error:</strong> {job.error_message}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

