// Backend page to view and manage datasets

'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { CopyableId } from '@/components/ui/copyable-id';
import { PipelineProgress } from '@/components/datasets/pipeline-progress';
import { Play, PlayCircle, ExternalLink } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';

interface Dataset {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
  user_id: string;
  listing_count?: number;
}

interface PipelineProgressData {
  completedStages: string[];
  nextStage: string | null;
  jobStatuses?: Record<string, 'completed' | 'running' | 'failed'>;
}

export default function DatasetsPage() {
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [progressData, setProgressData] = useState<Record<string, PipelineProgressData>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [runningJobs, setRunningJobs] = useState<Set<string>>(new Set());
  const { toast } = useToast();

  const fetchProgressForDatasets = async (datasetsToUpdate: Dataset[]) => {
    if (!datasetsToUpdate.length) return;

    try {
      const progressPromises = datasetsToUpdate.map(async (dataset: Dataset) => {
        try {
          const progressResponse = await fetch(`/api/datasets/${dataset.id}/progress`);
          if (progressResponse.ok) {
            const progress = await progressResponse.json();
            return { datasetId: dataset.id, progress };
          }
          return {
            datasetId: dataset.id,
            progress: { completedStages: [], nextStage: null, jobStatuses: {} },
          };
        } catch (err) {
          console.error(`Error fetching progress for dataset ${dataset.id}:`, err);
          return {
            datasetId: dataset.id,
            progress: { completedStages: [], nextStage: null, jobStatuses: {} },
          };
        }
      });

      const progressResults = await Promise.all(progressPromises);
      const progressMap: Record<string, PipelineProgressData> = {};
      progressResults.forEach(({ datasetId, progress }) => {
        progressMap[datasetId] = progress;
      });
      setProgressData((prev) => ({ ...prev, ...progressMap }));
    } catch (err) {
      console.error('Error fetching dataset progress:', err);
    }
  };

  const fetchDatasets = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch('/api/datasets');
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to fetch datasets');
      }
      const data = await response.json();
      const datasetsFromApi: Dataset[] = data || [];
      setDatasets(datasetsFromApi);

      // Initial progress fetch for all datasets
      await fetchProgressForDatasets(datasetsFromApi);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDatasets();
  }, []);

  // Keep pipeline progress up to date by polling in the background
  useEffect(() => {
    if (!datasets.length) return;

    const interval = setInterval(() => {
      // Refresh progress for all currently loaded datasets
      fetchProgressForDatasets(datasets);
    }, 5000); // every 5 seconds

    return () => {
      clearInterval(interval);
    };
  }, [datasets]);

  const handleCancelRunningJob = async (dataset: Dataset) => {
    if (runningJobs.has(dataset.id)) {
      return;
    }

    setRunningJobs((prev) => new Set(prev).add(dataset.id));

    try {
      // Find the running job for this dataset
      const jobsResponse = await fetch(
        `/api/jobs?dataset_id=${encodeURIComponent(dataset.id)}&status=running&limit=1`
      );

      if (!jobsResponse.ok) {
        const jobsData = await jobsResponse.json();
        throw new Error(jobsData.error || 'Failed to fetch running jobs');
      }

      const jobsData = await jobsResponse.json();
      const jobs = jobsData.jobs || [];
      const runningJob = jobs[0];

      if (!runningJob) {
        toast({
          title: 'No running job found',
          description: 'There is no running job for this dataset to cancel.',
        });
      } else {
        const cancelResponse = await fetch(`/api/jobs/${runningJob.id}/cancel`, {
          method: 'POST',
        });

        const cancelData = await cancelResponse.json();

        if (!cancelResponse.ok) {
          throw new Error(cancelData.error || 'Failed to cancel job');
        }

        toast({
          title: 'Job cancelled',
          description: 'The running job has been cancelled.',
        });

        // Refresh progress after cancelling
        await fetchProgressForDatasets([dataset]);
      }
    } catch (err) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Failed to cancel job',
        variant: 'destructive',
      });
    } finally {
      setRunningJobs((prev) => {
        const next = new Set(prev);
        next.delete(dataset.id);
        return next;
      });
    }
  };

  const handleRunNextJob = async (dataset: Dataset) => {
    if (runningJobs.has(dataset.id)) {
      return;
    }

    setRunningJobs((prev) => new Set(prev).add(dataset.id));

    try {
      const response = await fetch(`/api/datasets/${dataset.id}/run-next-job`, {
        method: 'POST',
      });

      const data = await response.json();

      if (!response.ok) {
        toast({
          title: 'Error',
          description: data.error || 'Failed to trigger job',
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Job Started',
          description: 'The next job in the pipeline has been triggered. Check the Jobs page for status.',
        });
        // Refresh progress after a short delay
        setTimeout(() => {
          fetch(`/api/datasets/${dataset.id}/progress`)
            .then((res) => res.json())
            .then((progress) => {
              setProgressData((prev) => ({
                ...prev,
                [dataset.id]: progress,
              }));
            })
            .catch(console.error);
        }, 1000);
      }
    } catch (err) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Failed to trigger job',
        variant: 'destructive',
      });
    } finally {
      setRunningJobs((prev) => {
        const next = new Set(prev);
        next.delete(dataset.id);
        return next;
      });
    }
  };

  const handleRunToCompletion = async (dataset: Dataset) => {
    if (runningJobs.has(dataset.id)) {
      return;
    }

    setRunningJobs((prev) => new Set(prev).add(dataset.id));

    try {
      const response = await fetch(`/api/datasets/${dataset.id}/run-to-completion`, {
        method: 'POST',
      });

      const data = await response.json();

      if (!response.ok) {
        toast({
          title: 'Error',
          description: data.error || 'Failed to trigger pipeline',
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Pipeline Started',
          description: `Running ${data.stagesCount} remaining job(s) to completion. Check the Jobs page for status.`,
        });
        // Refresh progress after a short delay
        setTimeout(() => {
          fetch(`/api/datasets/${dataset.id}/progress`)
            .then((res) => res.json())
            .then((progress) => {
              setProgressData((prev) => ({
                ...prev,
                [dataset.id]: progress,
              }));
            })
            .catch(console.error);
        }, 1000);
      }
    } catch (err) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Failed to trigger pipeline',
        variant: 'destructive',
      });
    } finally {
      setRunningJobs((prev) => {
        const next = new Set(prev);
        next.delete(dataset.id);
        return next;
      });
    }
  };

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateString;
    }
  };

  if (error) {
    return (
      <div className="flex flex-col h-full bg-background text-foreground p-4">
        <div className="flex items-center justify-between mb-4 shrink-0">
          <h1 className="text-2xl font-bold">Datasets</h1>
        </div>
        <div className="bg-destructive/10 border border-destructive/20 text-destructive px-4 py-3 rounded">
          Error: {error}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-background text-foreground p-4">
      {/* Header section - fixed */}
      <div className="flex items-center justify-between mb-4 shrink-0">
        <h1 className="text-2xl font-bold">Datasets</h1>
        <Button
          variant="outline"
          size="sm"
          onClick={() => fetchDatasets()}
          disabled={loading}
        >
          {loading ? 'Refreshing...' : 'Refresh'}
        </Button>
      </div>

      {/* Total count display - fixed */}
      <div className="mb-4 shrink-0">
        <p className="text-sm text-foreground/70">
          Total: <span className="font-semibold text-foreground">{datasets.length.toLocaleString()}</span> dataset{datasets.length !== 1 ? 's' : ''}
        </p>
      </div>

      {/* Scrollable table container */}
      <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
        {/* Loading state */}
        {loading && !datasets.length && (
          <div className="space-y-2">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </div>
        )}

        {/* Data table - scrollable */}
        {!loading && (
          <div className="rounded-md border border-foreground/10 h-full flex flex-col overflow-hidden">
            <div className="overflow-auto flex-1">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[200px]">Dataset Name</TableHead>
                    <TableHead className="w-[150px]">Dataset ID</TableHead>
                    <TableHead className="w-[400px]">Pipeline Progress</TableHead>
                    <TableHead className="w-[100px]">Listings</TableHead>
                    <TableHead className="w-[100px]">Jobs</TableHead>
                    <TableHead className="w-[150px]">Created</TableHead>
                    <TableHead className="w-[200px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {datasets.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="h-16 text-center text-sm text-foreground/70">
                        No datasets found.
                      </TableCell>
                    </TableRow>
                  ) : (
                    datasets.map((dataset) => {
                      const progress = progressData[dataset.id] || { completedStages: [], nextStage: null, jobStatuses: {} };
                      const hasNextStage = progress.nextStage !== null;
                      const hasRunningJob =
                        progress.jobStatuses &&
                        Object.values(progress.jobStatuses).some((status) => status === 'running');
                      const isPendingAction = runningJobs.has(dataset.id);

                      return (
                        <TableRow key={dataset.id} className="h-12">
                          <TableCell>
                            <div className="flex flex-col">
                              <span className="text-sm font-medium text-foreground">{dataset.name}</span>
                              {dataset.description && (
                                <span className="text-xs text-foreground/60 mt-0.5">{dataset.description}</span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <CopyableId id={dataset.id} />
                          </TableCell>
                          <TableCell>
                            <PipelineProgress 
                              completedStages={progress.completedStages} 
                              jobStatuses={progress.jobStatuses}
                            />
                          </TableCell>
                          <TableCell>
                            <span className="text-sm text-foreground/70">
                              {dataset.listing_count?.toLocaleString() ?? '—'}
                            </span>
                          </TableCell>
                          <TableCell>
                            <Link
                              href={`/backend/resources/jobs?dataset_id=${dataset.id}`}
                              className="text-xs text-primary hover:text-primary/80 flex items-center gap-1"
                            >
                              View Jobs
                              <ExternalLink className="h-3 w-3" />
                            </Link>
                          </TableCell>
                          <TableCell>
                            <span className="text-xs text-foreground/70">
                              {formatDate(dataset.created_at)}
                            </span>
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              {hasRunningJob ? (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleCancelRunningJob(dataset)}
                                  disabled={isPendingAction}
                                  className="h-7 px-2 text-xs"
                                >
                                  <Play className="h-3 w-3 mr-1 rotate-90" />
                                  {isPendingAction ? 'Cancelling...' : 'Cancel job'}
                                </Button>
                              ) : (
                                <>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleRunNextJob(dataset)}
                                    disabled={isPendingAction || !hasNextStage}
                                    className="h-7 px-2 text-xs"
                                    title="Run the next job in the pipeline"
                                  >
                                    <Play className="h-3 w-3 mr-1" />
                                    {isPendingAction ? 'Starting...' : hasNextStage ? 'Run Next' : 'Complete'}
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleRunToCompletion(dataset)}
                                    disabled={isPendingAction || !hasNextStage || !progress.completedStages.includes('ebay_refresh_listings')}
                                    className="h-7 px-2 text-xs"
                                    title={
                                      !progress.completedStages.includes('ebay_refresh_listings')
                                        ? 'Capture must be complete before running all'
                                        : 'Run all remaining jobs to completion'
                                    }
                                  >
                                    <PlayCircle className="h-3 w-3 mr-1" />
                                    Run All
                                  </Button>
                                </>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        )}

        {/* Empty state */}
        {!loading && datasets.length === 0 && (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center text-foreground/70">
              <p className="text-lg font-medium mb-2">No datasets found</p>
              <p className="text-sm">Create a dataset by running a capture job with a dataset name</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
