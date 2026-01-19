// Backend page to view all jobs

'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, Copy, X, Search } from 'lucide-react';
import { useRouter } from 'next/navigation';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { JobDetailPanel } from '@/components/jobs/job-detail-panel';
import {
  DataTable,
  DataTableHeader,
  DataTableHeaderRow,
  DataTableHeaderCell,
  DataTableBody,
  DataTableRow,
  DataTableCell,
  DataTableEmpty,
} from '@/components/ui/data-table';

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

const PAGE_SIZE = 50;

export default function JobsPage() {
  const router = useRouter();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [isPanelOpen, setIsPanelOpen] = useState(false);

  const fetchJobs = async (silent = false, currentPage = page) => {
    try {
      if (!silent) {
        setLoading(true);
      }
      setError(null);
      const offset = currentPage * PAGE_SIZE;
      const response = await fetch(`/api/jobs?limit=${PAGE_SIZE}&offset=${offset}`);
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to fetch jobs');
      }
      const data = await response.json();
      const newJobs = data.jobs || [];
      setJobs(newJobs);
      setTotal(data.count || 0);
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
    fetchJobs(false, page);

    // Set up polling interval
    // Poll every 2 seconds to keep data fresh
    const pollInterval = setInterval(() => {
      fetchJobs(true, page).catch(() => {
        // Silently handle errors during polling
      });
    }, 2000); // Poll every 2 seconds

    return () => {
      clearInterval(pollInterval);
    };
  }, [page]); // Re-fetch when page changes

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
        return 'bg-yellow-500/20 text-yellow-600 dark:text-yellow-400 border border-yellow-500/30';
      case 'completed':
        return 'bg-green-500/20 text-green-600 dark:text-green-400 border border-green-500/30';
      case 'failed':
        return 'bg-red-500/20 text-red-600 dark:text-red-400 border border-red-500/30';
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
  const totalPages = Math.ceil(total / PAGE_SIZE);

  const handlePageChange = (newPage: number) => {
    const validPage = Math.max(0, Math.min(newPage, totalPages - 1));
    setPage(validPage);
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      // You could add a toast notification here if desired
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
    }
  };

  const handleCancelJob = async (jobId: string) => {
    if (!confirm('Are you sure you want to cancel this job?')) {
      return;
    }

    try {
      const response = await fetch(`/api/jobs/${jobId}/cancel`, {
        method: 'POST',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to cancel job');
      }

      // Refresh jobs to show updated status
      await fetchJobs(false, page);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to cancel job');
    }
  };

  const handleJobClick = (job: Job) => {
    setSelectedJob(job);
    setIsPanelOpen(true);
  };


  return (
    <div className="flex flex-col h-full bg-background text-foreground p-4">
      {/* Header section - fixed */}
      <div className="flex items-center justify-between mb-4 shrink-0">
        <h1 className="text-2xl font-bold text-foreground">Jobs</h1>
        <div className="flex items-center gap-3">
          {hasRunningJobs && (
            <>
              <span className="text-xs text-foreground/60 flex items-center gap-2">
                <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                Auto-refreshing every 2s...
              </span>
              <span className="text-xs text-foreground/70 font-medium">
                {runningJobsCount} job{runningJobsCount !== 1 ? 's' : ''} running
              </span>
            </>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchJobs(false, page)}
            disabled={loading}
          >
            {loading ? 'Refreshing...' : 'Refresh'}
          </Button>
        </div>
      </div>

      {/* Total count display - fixed */}
      <div className="mb-4 shrink-0">
        <p className="text-sm text-foreground/70">
          Total: <span className="font-semibold text-foreground">{total.toLocaleString()}</span> jobs
          {jobs.length > 0 && (
            <span className="ml-2">
              (showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)})
            </span>
          )}
        </p>
      </div>

      {/* Error state */}
      {error && (
        <div className="bg-destructive/10 border border-destructive/20 text-destructive px-4 py-3 rounded mb-4 shrink-0">
          Error: {error}
        </div>
      )}

      {/* Scrollable table container */}
      <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
        {loading && !jobs.length && (
          <div className="flex items-center justify-center h-full">
            <p className="text-foreground/70">Loading jobs...</p>
          </div>
        )}

        {!loading && !error && (
          <>
            <div className="flex-1 min-h-0 w-full overflow-hidden">
              <DataTable>
                <table className="w-full caption-bottom text-sm table-auto">
                  <DataTableHeader>
                    <DataTableHeaderRow>
                      <DataTableHeaderCell className="px-2 py-2 text-xs uppercase tracking-wider w-16">
                        ID
                      </DataTableHeaderCell>
                      <DataTableHeaderCell className="px-2 py-2 text-xs uppercase tracking-wider w-32">
                        Type
                      </DataTableHeaderCell>
                      <DataTableHeaderCell className="px-2 py-2 text-xs uppercase tracking-wider w-20">
                        Status
                      </DataTableHeaderCell>
                      <DataTableHeaderCell className="px-2 py-2 text-xs uppercase tracking-wider w-40">
                        Progress
                      </DataTableHeaderCell>
                      <DataTableHeaderCell className="px-2 py-2 text-xs uppercase tracking-wider w-40">
                        Timestamps
                      </DataTableHeaderCell>
                      <DataTableHeaderCell className="px-2 py-2 text-xs uppercase tracking-wider w-20">
                        Actions
                      </DataTableHeaderCell>
                    </DataTableHeaderRow>
                  </DataTableHeader>
                  <DataTableBody>
                    {jobs.length === 0 ? (
                      <DataTableEmpty colSpan={6} message="No jobs found" />
                    ) : (
                      jobs.map((job) => (
                        <DataTableRow key={job.id} onClick={() => handleJobClick(job)}>
                          <DataTableCell className="px-2 py-2 text-xs font-mono text-foreground/70 whitespace-nowrap">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                copyToClipboard(job.id);
                              }}
                              className="hover:text-foreground flex items-center gap-1 group cursor-pointer"
                              title="Click to copy full ID"
                            >
                              <span>{truncateId(job.id)}</span>
                              <Copy className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                            </button>
                          </DataTableCell>
                          <DataTableCell className="px-2 py-2 text-xs text-foreground">
                            <span className="truncate block" title={getTypeDisplay(job.type)}>
                              {getTypeDisplay(job.type)}
                            </span>
                          </DataTableCell>
                          <DataTableCell className="px-2 py-2 text-xs whitespace-nowrap">
                            <span
                              className={`px-1.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(
                                job.status
                              )}`}
                            >
                              {job.status}
                            </span>
                          </DataTableCell>
                          <DataTableCell className="px-2 py-2 text-xs">
                            {job.status === 'running' && job.last_update ? (
                              <div className="min-w-0">
                                <div className="text-foreground/90 text-xs font-medium mb-0.5 truncate">
                                  {job.last_update}
                                </div>
                                {job.updated_at && (
                                  <div className="text-foreground/50 text-xs truncate">
                                    {formatDate(job.updated_at)}
                                  </div>
                                )}
                              </div>
                            ) : job.last_update ? (
                              <div className="text-foreground/70 text-xs truncate">
                                {job.last_update}
                              </div>
                            ) : (
                              <span className="text-foreground/40">—</span>
                            )}
                          </DataTableCell>
                          <DataTableCell className="px-2 py-2 text-xs text-foreground/70">
                            <div className="space-y-0.5 text-xs leading-tight">
                              <div>Started: {formatDate(job.started_at)}</div>
                              {job.completed_at && (
                                <div>Completed: {formatDate(job.completed_at)}</div>
                              )}
                            </div>
                          </DataTableCell>
                          <DataTableCell className="px-2 py-2 text-xs">
                            <div className="flex items-center gap-1">
                              {job.type === 'reconcile' && job.status === 'completed' && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    router.push(`/backend/resources/reconcile/${job.id}`);
                                  }}
                                  className="h-6 px-2 text-xs"
                                  title="Analyze reconciliation results"
                                >
                                  <Search className="h-3 w-3" />
                                </Button>
                              )}
                              {job.status === 'running' && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleCancelJob(job.id);
                                  }}
                                  className="h-6 px-2 text-xs"
                                >
                                  <X className="h-3 w-3 mr-1" />
                                  Cancel
                                </Button>
                              )}
                            </div>
                          </DataTableCell>
                        </DataTableRow>
                      ))
                    )}
                  </DataTableBody>
                </table>
              </DataTable>
            </div>

              {/* Pagination - fixed at bottom */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4 shrink-0 pt-4 border-t border-foreground/10">
                  <div className="text-sm text-foreground/70">
                    Page {page + 1} of {totalPages}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePageChange(page - 1)}
                      disabled={page === 0}
                    >
                      <ChevronLeft className="h-4 w-4" />
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePageChange(page + 1)}
                      disabled={page >= totalPages - 1}
                    >
                      Next
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
      </div>

      {/* Job Detail Panel */}
      <Sheet
        open={isPanelOpen}
        onOpenChange={(open) => {
          setIsPanelOpen(open);
          if (!open) {
            // Clear selected job after animation completes
            setTimeout(() => setSelectedJob(null), 300);
          }
        }}
      >
        <SheetContent
          side="right"
          className="w-[80%] sm:w-1/2 sm:max-w-none overflow-y-auto"
        >
          {selectedJob && (
            <>
              <SheetHeader>
                <SheetTitle>Job Details</SheetTitle>
              </SheetHeader>
              <div className="mt-6">
                <JobDetailPanel
                  job={selectedJob}
                  onCancelJob={async (jobId) => {
                    await handleCancelJob(jobId);
                    // Refresh jobs list
                    await fetchJobs(false, page);
                    // Fetch updated job details
                    try {
                      const response = await fetch(`/api/capture/status/${jobId}`);
                      if (response.ok) {
                        const updatedJob = await response.json();
                        setSelectedJob(updatedJob);
                      }
                    } catch (err) {
                      console.error('Failed to refresh job details:', err);
                    }
                  }}
                />
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

