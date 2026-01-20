import { useMutation, useQuery } from '@tanstack/react-query';

export interface MaterializePayload {
  captureJobId: string;
  marketplace: string;
}

export interface MaterializeResponse {
  status: string;
  message: string;
}

export interface CaptureJob {
  id: string;
  started_at: string;
  completed_at: string | null;
  status: string;
  metadata: {
    keywords?: string[];
  };
  rawListingsCount?: number;
}

async function triggerMaterialize(payload: MaterializePayload): Promise<MaterializeResponse> {
  const response = await fetch('/api/materialize/trigger', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const data = await response.json();
    throw new Error(data.error || 'Failed to trigger materialize job');
  }

  return response.json();
}

async function fetchCaptureJobs(): Promise<CaptureJob[]> {
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
  
  return jobsWithCounts;
}

export function useTriggerMaterialize() {
  return useMutation({
    mutationFn: triggerMaterialize,
  });
}

export function useCaptureJobs() {
  return useQuery({
    queryKey: ['capture-jobs'],
    queryFn: fetchCaptureJobs,
    staleTime: 60 * 1000, // Cache for 1 minute
  });
}
