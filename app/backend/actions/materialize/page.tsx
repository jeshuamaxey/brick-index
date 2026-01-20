// Backend page for materialize action

'use client';

import { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { useTriggerMaterialize, useCaptureJobs } from '@/hooks/use-materialize';
import { useToast } from '@/hooks/use-toast';
import { ActionPageHeader } from '@/components/backend/action-page-header';
import { InngestPayloadCard } from '@/components/backend/inngest-payload-card';

export default function MaterializePage() {
  const router = useRouter();
  const { toast } = useToast();
  const [captureJobId, setCaptureJobId] = useState('');
  const [marketplace, setMarketplace] = useState('ebay');

  const { data: captureJobs, isLoading: loadingJobs } = useCaptureJobs();
  const triggerMaterialize = useTriggerMaterialize();
  const [datasetName, setDatasetName] = useState<string | null>(null);
  const [loadingDataset, setLoadingDataset] = useState(false);

  // Compute selectedJob before it's used in useEffect
  const selectedJob = captureJobs?.find(job => job.id === captureJobId);

  // Set default capture job when jobs load
  useEffect(() => {
    if (captureJobs && captureJobs.length > 0 && !captureJobId) {
      setCaptureJobId(captureJobs[0].id);
    }
  }, [captureJobs, captureJobId]);

  // Fetch dataset name when capture job is selected
  useEffect(() => {
    const fetchDatasetName = async () => {
      if (!captureJobId || !selectedJob) {
        setDatasetName(null);
        return;
      }

      const metadata = selectedJob.metadata as Record<string, unknown> | null;
      const datasetId = metadata?.dataset_id as string | undefined;

      if (!datasetId) {
        setDatasetName(null);
        return;
      }

      setLoadingDataset(true);
      try {
        const response = await fetch(`/api/datasets`);
        if (response.ok) {
          const datasets = await response.json();
          const dataset = datasets.find((d: { id: string }) => d.id === datasetId);
          setDatasetName(dataset?.name || null);
        } else {
          setDatasetName(null);
        }
      } catch (error) {
        console.error('Error fetching dataset:', error);
        setDatasetName(null);
      } finally {
        setLoadingDataset(false);
      }
    };

    fetchDatasetName();
  }, [captureJobId, selectedJob]);

  // Generate JSON payload for Inngest
  const inngestPayload = useMemo(() => {
    return {
      name: 'job/materialize.triggered',
      data: {
        captureJobId: captureJobId || '',
        marketplace: marketplace || 'ebay',
      },
    };
  }, [captureJobId, marketplace]);

  const formatDateTime = (dateString: string | null) => {
    if (!dateString) return 'N/A';
    try {
      const date = new Date(dateString);
      return date.toLocaleString();
    } catch {
      return 'N/A';
    }
  };

  const handleSubmit = () => {
    if (!captureJobId) {
      toast({
        title: 'Validation error',
        description: 'Please select a capture job',
        variant: 'destructive',
      });
      return;
    }

    if (!marketplace) {
      toast({
        title: 'Validation error',
        description: 'Marketplace is required',
        variant: 'destructive',
      });
      return;
    }

    triggerMaterialize.mutate(
      { captureJobId, marketplace },
      {
        onSuccess: () => {
          toast({
            title: 'Materialize job started',
            description: 'The materialize job has been triggered successfully.',
            action: (
              <Button
                variant="outline"
                size="sm"
                onClick={() => router.push('/backend/resources/jobs')}
              >
                Go to Jobs
              </Button>
            ),
          });
        },
        onError: (error: Error) => {
          toast({
            title: 'Failed to trigger materialize job',
            description: error.message,
            variant: 'destructive',
          });
        },
      }
    );
  };

  return (
    <div className="p-8 bg-background">
      <ActionPageHeader title="Materialize" />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Materialize Listings</CardTitle>
            <CardDescription>
              Transforms raw listings from a capture job into structured listings in the database. 
              This job processes raw API responses, deduplicates listings, and inserts or updates 
              entries in the listings table.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {loadingJobs ? (
              <p className="text-sm text-muted-foreground">Loading capture jobs...</p>
            ) : !captureJobs || captureJobs.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No capture jobs found. Please run a capture job first.
              </p>
            ) : (
              <>
                <div className="space-y-4">
                  {/* Capture Job Selection */}
                  <div className="space-y-2">
                    <Label htmlFor="captureJobId">Capture Job</Label>
                    <Select value={captureJobId} onValueChange={setCaptureJobId}>
                      <SelectTrigger id="captureJobId" className="w-full">
                        <SelectValue placeholder="Select a capture job" />
                      </SelectTrigger>
                      <SelectContent>
                        {captureJobs.map((job) => {
                          const jobMetadata = job.metadata as Record<string, unknown> | null;
                          const jobDatasetName = jobMetadata?.dataset_name as string | undefined;
                          return (
                            <SelectItem key={job.id} value={job.id}>
                              <span className="font-medium">{job.status}</span>
                              {job.rawListingsCount !== undefined && ` - ${job.rawListingsCount.toLocaleString()} raw listings`}
                              {jobDatasetName && ` - Dataset: ${jobDatasetName}`}
                              {job.metadata?.keywords && ` (${job.metadata.keywords.join(', ')})`}
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                    {selectedJob && (
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground">
                          Started: {formatDateTime(selectedJob.started_at)} | 
                          Completed: {formatDateTime(selectedJob.completed_at)} | 
                          Status: {selectedJob.status}
                        </p>
                        {loadingDataset ? (
                          <p className="text-xs text-muted-foreground">Loading dataset...</p>
                        ) : datasetName ? (
                          <p className="text-xs text-muted-foreground">
                            Dataset: <span className="font-medium">{datasetName}</span>
                          </p>
                        ) : null}
                      </div>
                    )}
                  </div>

                  {/* Marketplace */}
                  <div className="space-y-2">
                    <Label htmlFor="marketplace">Marketplace</Label>
                    <Input
                      id="marketplace"
                      type="text"
                      value={marketplace}
                      onChange={(e) => setMarketplace(e.target.value)}
                      placeholder="ebay"
                    />
                    <p className="text-xs text-muted-foreground">
                      The marketplace where the capture job was run (e.g., 'ebay')
                    </p>
                  </div>
                </div>
              </>
            )}
          </CardContent>
          <CardFooter>
            <Button
              onClick={handleSubmit}
              disabled={triggerMaterialize.isPending || !captureJobId || !captureJobs || captureJobs.length === 0}
              className="w-full"
            >
              {triggerMaterialize.isPending ? 'Materializing...' : 'Trigger Materialize'}
            </Button>
          </CardFooter>
        </Card>

        <InngestPayloadCard payload={inngestPayload} />
      </div>
    </div>
  );
}
