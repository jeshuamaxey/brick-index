// Dev page to view all jobs

'use client';

import { useState, useEffect } from 'react';
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

export default function JobsPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchJobs = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch('/api/jobs?limit=100');
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to fetch jobs');
      }
      const data = await response.json();
      setJobs(data.jobs || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchJobs();
  }, []);

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

  return (
    <div className="p-8 bg-background text-foreground">
      <h1 className="text-2xl font-bold mb-4">Jobs</h1>
      <DevNav />

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
                  Started At
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
                  <td colSpan={8} className="px-4 py-8 text-center text-foreground/70">
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
                    <td className="px-4 py-3 text-sm text-foreground/70 border-b border-foreground/10">
                      {formatDate(job.started_at)}
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

