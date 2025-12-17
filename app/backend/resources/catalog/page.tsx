// Backend page to view catalog statistics and manage catalog refresh

'use client';

import { useState, useEffect } from 'react';

interface CatalogStats {
  total_sets: number;
  total_themes: number;
  last_refresh: {
    id: string;
    status: string;
    started_at: string;
    completed_at: string | null;
    files_checked: number;
    files_changed: number;
    files_unchanged: number;
    sets_new: number;
    sets_updated: number;
    themes_new: number;
    themes_updated: number;
  } | null;
}

interface RefreshJob {
  id: string;
  status: 'running' | 'completed' | 'failed';
  metadata?: {
    files_checked?: number;
    files_changed?: number;
    files_unchanged?: number;
    sets_found?: number;
    sets_new?: number;
    sets_updated?: number;
    themes_found?: number;
    themes_new?: number;
    themes_updated?: number;
  };
  started_at: string;
  completed_at: string | null;
  error_message: string | null;
}

export default function CatalogPage() {
  const [stats, setStats] = useState<CatalogStats | null>(null);
  const [recentJobs, setRecentJobs] = useState<RefreshJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchStats = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch catalog statistics
      // Note: This would require a new API endpoint or direct Supabase query
      // For now, we'll fetch from jobs API to get recent refresh jobs
      const jobsResponse = await fetch('/api/jobs?type=lego_catalog_refresh&limit=10');
      if (!jobsResponse.ok) {
        throw new Error('Failed to fetch catalog jobs');
      }
      const jobsData = await jobsResponse.json();
      const jobs = (jobsData.jobs || []) as RefreshJob[];

      setRecentJobs(jobs);

      // Get the most recent completed job for stats
      const lastCompletedJob = jobs.find((j) => j.status === 'completed');
      const lastJob = jobs[0] || null;
      const metadata = lastJob?.metadata || {};

      // For now, we'll show job-based stats
      // In production, you'd want a dedicated API endpoint for catalog stats
      setStats({
        total_sets: metadata.sets_found || 0,
        total_themes: metadata.themes_found || 0,
        last_refresh: lastJob
          ? {
              id: lastJob.id,
              status: lastJob.status,
              started_at: lastJob.started_at,
              completed_at: lastJob.completed_at,
              files_checked: metadata.files_checked || 0,
              files_changed: metadata.files_changed || 0,
              files_unchanged: metadata.files_unchanged || 0,
              sets_new: metadata.sets_new || 0,
              sets_updated: metadata.sets_updated || 0,
              themes_new: metadata.themes_new || 0,
              themes_updated: metadata.themes_updated || 0,
            }
          : null,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();

    // Poll for updates if there are running jobs
    const pollInterval = setInterval(() => {
      const hasRunning = recentJobs.some((j) => j.status === 'running');
      if (hasRunning) {
        fetchStats();
      }
    }, 2000);

    return () => clearInterval(pollInterval);
  }, []);

  const triggerRefresh = async () => {
    try {
      setRefreshing(true);
      setError(null);

      const response = await fetch('/api/catalog/refresh', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to trigger catalog refresh');
      }

      // Refresh stats after triggering
      setTimeout(() => {
        fetchStats();
      }, 1000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setRefreshing(false);
    }
  };

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

  const hasRunningJobs = recentJobs.some((job) => job.status === 'running');

  return (
    <div className="p-8 bg-background text-foreground">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">LEGO Catalog</h1>
        <div className="flex items-center gap-3">
          {hasRunningJobs && (
            <span className="text-xs text-foreground/60 flex items-center gap-2">
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
              Auto-refreshing...
            </span>
          )}
          <button
            onClick={triggerRefresh}
            disabled={refreshing || hasRunningJobs}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {refreshing ? 'Refreshing...' : 'Refresh Catalog'}
          </button>
        </div>
      </div>

      {loading && <p className="text-foreground/70">Loading catalog statistics...</p>}
      {error && (
        <div className="bg-red-500/20 border border-red-500/30 text-red-700 dark:text-red-400 px-4 py-3 rounded mb-4">
          Error: {error}
        </div>
      )}

      {!loading && !error && stats && (
        <div className="space-y-6">
          {/* Statistics Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-foreground/5 border border-foreground/10 rounded-lg p-4">
              <div className="text-sm text-foreground/60 mb-1">Total Sets</div>
              <div className="text-2xl font-bold">
                {stats.total_sets.toLocaleString()}
              </div>
            </div>
            <div className="bg-foreground/5 border border-foreground/10 rounded-lg p-4">
              <div className="text-sm text-foreground/60 mb-1">Total Themes</div>
              <div className="text-2xl font-bold">
                {stats.total_themes.toLocaleString()}
              </div>
            </div>
            <div className="bg-foreground/5 border border-foreground/10 rounded-lg p-4">
              <div className="text-sm text-foreground/60 mb-1">Last Refresh</div>
              <div className="text-sm font-medium">
                {stats.last_refresh
                  ? formatDate(stats.last_refresh.completed_at || stats.last_refresh.started_at)
                  : 'Never'}
              </div>
            </div>
          </div>

          {/* Last Refresh Details */}
          {stats.last_refresh && (
            <div className="bg-foreground/5 border border-foreground/10 rounded-lg p-4">
              <h2 className="text-lg font-semibold mb-3">Last Refresh Details</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <div className="text-foreground/60 mb-1">Status</div>
                  <span
                    className={`inline-block px-2 py-1 rounded text-xs font-medium ${getStatusColor(
                      stats.last_refresh.status
                    )}`}
                  >
                    {stats.last_refresh.status}
                  </span>
                </div>
                <div>
                  <div className="text-foreground/60 mb-1">Files Checked</div>
                  <div className="font-medium">{stats.last_refresh.files_checked}</div>
                </div>
                <div>
                  <div className="text-foreground/60 mb-1">Files Changed</div>
                  <div className="font-medium">{stats.last_refresh.files_changed}</div>
                </div>
                <div>
                  <div className="text-foreground/60 mb-1">Files Unchanged</div>
                  <div className="font-medium">{stats.last_refresh.files_unchanged}</div>
                </div>
                <div>
                  <div className="text-foreground/60 mb-1">New Sets</div>
                  <div className="font-medium">{stats.last_refresh.sets_new}</div>
                </div>
                <div>
                  <div className="text-foreground/60 mb-1">Updated Sets</div>
                  <div className="font-medium">{stats.last_refresh.sets_updated}</div>
                </div>
                <div>
                  <div className="text-foreground/60 mb-1">New Themes</div>
                  <div className="font-medium">{stats.last_refresh.themes_new}</div>
                </div>
                <div>
                  <div className="text-foreground/60 mb-1">Updated Themes</div>
                  <div className="font-medium">{stats.last_refresh.themes_updated}</div>
                </div>
              </div>
            </div>
          )}

          {/* Recent Refresh Jobs */}
          <div>
            <h2 className="text-lg font-semibold mb-3">Recent Refresh Jobs</h2>
            <div className="overflow-x-auto">
              <table className="min-w-full bg-background border border-foreground/10">
                <thead className="bg-foreground/5">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-foreground/70 uppercase tracking-wider border-b border-foreground/10">
                      Status
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-foreground/70 uppercase tracking-wider border-b border-foreground/10">
                      Files
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-foreground/70 uppercase tracking-wider border-b border-foreground/10">
                      Sets
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-foreground/70 uppercase tracking-wider border-b border-foreground/10">
                      Themes
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-foreground/70 uppercase tracking-wider border-b border-foreground/10">
                      Started
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-foreground/70 uppercase tracking-wider border-b border-foreground/10">
                      Completed
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {recentJobs.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-foreground/60">
                        No refresh jobs found
                      </td>
                    </tr>
                  ) : (
                    recentJobs.map((job) => (
                      <tr key={job.id} className="border-b border-foreground/10">
                        <td className="px-4 py-3">
                          <span
                            className={`inline-block px-2 py-1 rounded text-xs font-medium ${getStatusColor(
                              job.status
                            )}`}
                          >
                            {job.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <div className="text-foreground/60">
                            {job.metadata?.files_changed || 0} changed, {job.metadata?.files_unchanged || 0} unchanged
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <div>
                            {job.metadata?.sets_new || 0} new, {job.metadata?.sets_updated || 0} updated
                          </div>
                          <div className="text-foreground/60 text-xs">
                            {job.metadata?.sets_found || 0} total
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <div>
                            {job.metadata?.themes_new || 0} new, {job.metadata?.themes_updated || 0} updated
                          </div>
                          <div className="text-foreground/60 text-xs">
                            {job.metadata?.themes_found || 0} total
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-foreground/70">
                          {formatDate(job.started_at)}
                        </td>
                        <td className="px-4 py-3 text-sm text-foreground/70">
                          {formatDate(job.completed_at)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
