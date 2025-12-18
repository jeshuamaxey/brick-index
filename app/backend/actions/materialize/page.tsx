// Backend page for materialize action

'use client';

import { useState, useEffect } from 'react';
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

interface CaptureJob {
  id: string;
  started_at: string;
  completed_at: string | null;
  status: string;
  metadata: {
    keywords?: string[];
  };
  rawListingsCount?: number;
}

export default function MaterializePage() {
  const [loadingAction, setLoadingAction] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadingJobs, setLoadingJobs] = useState(true);
  const [captureJobs, setCaptureJobs] = useState<CaptureJob[]>([]);

  // Form state
  const [captureJobId, setCaptureJobId] = useState('');
  const [marketplace, setMarketplace] = useState('ebay');

  useEffect(() => {
    fetchCaptureJobs();
  }, []);

  const fetchCaptureJobs = async () => {
    try {
      setLoadingJobs(true);
      // Fetch all capture jobs (completed, failed, or running) - not just completed
      const response = await fetch('/api/jobs?type=ebay_refresh_listings&limit=50');
      if (!response.ok) {
        throw new Error('Failed to fetch capture jobs');
      }
      const data = await response.json();
      const jobs = data.jobs || [];
      
      // Fetch raw listings count for each job
      const jobsWithCounts = await Promise.all(
        jobs.map(async (job: CaptureJob) => {
          try {
            const countResponse = await fetch(`/api/raw-listings/count?jobId=${job.id}`);
            if (countResponse.ok) {
              const countData = await countResponse.json();
              return { ...job, rawListingsCount: countData.count || 0 };
            }
          } catch (err) {
            console.error(`Error fetching count for job ${job.id}:`, err);
          }
          return { ...job, rawListingsCount: 0 };
        })
      );
      
      setCaptureJobs(jobsWithCounts);
      // Set the most recent job as default if available
      if (jobsWithCounts.length > 0) {
        setCaptureJobId(jobsWithCounts[0].id);
      }
    } catch (err) {
      console.error('Error fetching capture jobs:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch capture jobs');
    } finally {
      setLoadingJobs(false);
    }
  };

  const formatDateTime = (dateString: string | null) => {
    if (!dateString) return 'N/A';
    try {
      const date = new Date(dateString);
      return date.toLocaleString();
    } catch {
      return 'N/A';
    }
  };

  const triggerMaterialize = async () => {
    try {
      setLoadingAction(true);
      setError(null);
      setResult(null);

      if (!captureJobId) {
        throw new Error('Please select a capture job');
      }

      if (!marketplace) {
        throw new Error('Marketplace is required');
      }

      const response = await fetch('/api/materialize/trigger', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          captureJobId,
          marketplace,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to trigger materialize job');
      }

      const data = await response.json();
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoadingAction(false);
    }
  };

  const selectedJob = captureJobs.find(job => job.id === captureJobId);

  // Generate JSON payload for Inngest
  const generateInngestPayload = () => {
    return {
      name: 'job/materialize.triggered',
      data: {
        captureJobId: captureJobId || '',
        marketplace: marketplace || 'ebay',
      },
    };
  };

  return (
    <div className="p-8 bg-background">
      <h1 className="text-2xl font-bold mb-6 text-foreground">Materialize</h1>

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
          ) : captureJobs.length === 0 ? (
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
                      {captureJobs.map((job) => (
                        <SelectItem key={job.id} value={job.id}>
                          <span className="font-medium">{job.status}</span>
                          {job.rawListingsCount !== undefined && ` - ${job.rawListingsCount.toLocaleString()} raw listings`}
                          {job.metadata?.keywords && ` (${job.metadata.keywords.join(', ')})`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {selectedJob && (
                    <p className="text-xs text-muted-foreground">
                      Started: {formatDateTime(selectedJob.started_at)} | 
                      Completed: {formatDateTime(selectedJob.completed_at)} | 
                      Status: {selectedJob.status}
                    </p>
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
            onClick={triggerMaterialize}
            disabled={loadingAction || !captureJobId || captureJobs.length === 0}
            className="w-full"
          >
            {loadingAction ? 'Materializing...' : 'Trigger Materialize'}
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
            disabled={!captureJobId}
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
