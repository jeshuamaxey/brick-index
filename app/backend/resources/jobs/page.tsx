// Backend page to view all jobs

'use client';

import { useState, useEffect } from 'react';

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
  updated_at: string | null;
  last_update: string | null;
  error_message: string | null;
  metadata?: Record<string, unknown>;
}

export default function JobsPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchJobs = async (silent = false) => {
    try {
      if (!silent) {
        setLoading(true);
      }
      setError(null);
      const response = await fetch('/api/jobs?limit=100');
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to fetch jobs');
      }
      const data = await response.json();
      const newJobs = data.jobs || [];
      setJobs(newJobs);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    // Initial fetch
    fetchJobs();

    // Set up polling interval
    // Poll every 2 seconds to keep data fresh
    const pollInterval = setInterval(() => {
      fetchJobs(true).catch(() => {
        // Silently handle errors during polling
      });
    }, 2000); // Poll every 2 seconds

    return () => {
      clearInterval(pollInterval);
    };
  }, []); // Only run once on mount

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A';
    try {
      return new Date(dateString).toLocaleString();
    } catch {
      return dateString;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'running':
        return 'bg-yellow-500/20 text-yellow-700 dark:text-yellow-400 border border-yellow-500/30';
      case 'completed':
        return 'bg-green-500/20 text-green-700 dark:text-green-400 border border-green-500/30';
      case 'failed':
        return 'bg-red-500/20 text-red-700 dark:text-red-400 border border-red-500/30';
      default:
        return 'bg-foreground/10 text-foreground border border-foreground/20';
    }
  };

  const getTypeDisplay = (type: string) => {
    // Convert underscore-separated type to readable format
    return type.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
  };

  const truncateId = (id: string) => {
    return `${id.substring(0, 8)}...`;
  };

  const hasRunningJobs = jobs.some((job) => job.status === 'running');
  const runningJobsCount = jobs.filter((j) => j.status === 'running').length;

  return (
    <div className="p-8 bg-background text-foreground">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">Jobs</h1>
        <div className="flex items-center gap-3">
          {hasRunningJobs && (
            <>
              <span className="text-xs text-foreground/60 flex items-center gap-2">
                <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                Auto-refreshing every 2s...
              </span>
              <span className="text-xs text-yellow-600 dark:text-yellow-400 font-medium">
                {runningJobsCount} job{runningJobsCount !== 1 ? 's' : ''} running
              </span>
            </>
          )}
          <button
            onClick={() => fetchJobs()}
            disabled={loading}
            className="px-3 py-1.5 text-sm bg-foreground/10 hover:bg-foreground/20 border border-foreground/20 rounded disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
      </div>

      {loading && <p className="text-foreground/70">Loading jobs...</p>}
      {error && (
        <div className="bg-foreground/10 border border-foreground/20 text-foreground px-4 py-3 rounded mb-4">
          Error: {error}
        </div>
      )}

      {!loading && !error && (
        <div className="overflow-x-auto">
          <table className="min-w-full bg-background border border-foreground/10">
            <thead className="bg-foreground/5">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-foreground/70 uppercase tracking-wider border-b border-foreground/10">
                  ID
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-foreground/70 uppercase tracking-wider border-b border-foreground/10">
                  Type
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-foreground/70 uppercase tracking-wider border-b border-foreground/10">
                  Marketplace
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-foreground/70 uppercase tracking-wider border-b border-foreground/10">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-foreground/70 uppercase tracking-wider border-b border-foreground/10">
                  Progress
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-foreground/70 uppercase tracking-wider border-b border-foreground/10">
                  Started At
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-foreground/70 uppercase tracking-wider border-b border-foreground/10">
                  Updated At
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-foreground/70 uppercase tracking-wider border-b border-foreground/10">
                  Completed At
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-foreground/70 uppercase tracking-wider border-b border-foreground/10">
                  Results
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-foreground/70 uppercase tracking-wider border-b border-foreground/10">
                  Error
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-foreground/10">
              {jobs.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-foreground/70">
                    No jobs found
                  </td>
                </tr>
              ) : (
                jobs.map((job) => (
                  <tr key={job.id} className="hover:bg-foreground/5">
                    <td className="px-4 py-3 text-sm font-mono text-foreground/70 border-b border-foreground/10">
                      {truncateId(job.id)}
                    </td>
                    <td className="px-4 py-3 text-sm text-foreground border-b border-foreground/10">
                      {getTypeDisplay(job.type)}
                    </td>
                    <td className="px-4 py-3 text-sm text-foreground border-b border-foreground/10">
                      {job.marketplace}
                    </td>
                    <td className="px-4 py-3 text-sm border-b border-foreground/10">
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(
                          job.status
                        )}`}
                      >
                        {job.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm border-b border-foreground/10">
                      {job.status === 'running' && job.last_update ? (
                        <div className="max-w-xs">
                          <div className="text-foreground/90 text-xs font-medium mb-1">
                            {job.last_update}
                          </div>
                          {job.updated_at && (
                            <div className="text-foreground/50 text-xs">
                              {formatDate(job.updated_at)}
                            </div>
                          )}
                        </div>
                      ) : job.last_update ? (
                        <div className="text-foreground/70 text-xs max-w-xs">
                          {job.last_update}
                        </div>
                      ) : (
                        <span className="text-foreground/40">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-foreground/70 border-b border-foreground/10">
                      {formatDate(job.started_at)}
                    </td>
                    <td className="px-4 py-3 text-sm text-foreground/70 border-b border-foreground/10">
                      {job.updated_at ? (
                        <div className="text-xs">
                          {formatDate(job.updated_at)}
                        </div>
                      ) : (
                        <span className="text-foreground/40">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-foreground/70 border-b border-foreground/10">
                      {formatDate(job.completed_at)}
                    </td>
                    <td className="px-4 py-3 text-sm text-foreground/70 border-b border-foreground/10">
                      {job.type.includes('refresh') ? (
                        <div className="space-y-1">
                          <div>Found: {job.listings_found}</div>
                          <div>New: {job.listings_new}</div>
                          <div>Updated: {job.listings_updated}</div>
                        </div>
                      ) : job.type.includes('enrich') ? (
                        <div className="space-y-1">
                          <div>Total: {job.listings_found}</div>
                          <div>Succeeded: {job.listings_new}</div>
                          <div>Failed: {job.listings_updated}</div>
                        </div>
                      ) : job.type.includes('analyze') ? (
                        <div className="space-y-1">
                          <div>Total: {job.listings_found}</div>
                          <div>Analyzed: {job.listings_new}</div>
                          <div>Failed: {job.listings_updated}</div>
                        </div>
                      ) : (
                        <div>N/A</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm border-b border-foreground/10">
                      {job.error_message ? (
                        <span className="text-foreground/80 text-xs" title={job.error_message}>
                          {job.error_message.length > 50
                            ? `${job.error_message.substring(0, 50)}...`
                            : job.error_message}
                        </span>
                      ) : (
                        <span className="text-foreground/40">—</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {!loading && !error && jobs.length > 0 && (
        <div className="mt-4 text-sm text-foreground/70">
          Showing {jobs.length} job{jobs.length !== 1 ? 's' : ''} (most recent first)
        </div>
      )}
    </div>
  );
}

