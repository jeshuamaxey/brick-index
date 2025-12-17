import { useQuery } from '@tanstack/react-query';

export interface Job {
  id: string;
  type: string;
  marketplace: string;
  status: 'running' | 'completed' | 'failed';
  started_at: string;
  completed_at: string | null;
}

interface JobsResponse {
  jobs: Job[];
  count: number;
}

async function fetchJobs(): Promise<JobsResponse> {
  const response = await fetch('/api/jobs?limit=1000');
  
  if (!response.ok) {
    throw new Error('Failed to fetch jobs');
  }

  return response.json();
}

export function useJobs() {
  return useQuery({
    queryKey: ['jobs'],
    queryFn: fetchJobs,
    staleTime: 60 * 1000, // Jobs don't change often, cache for 1 minute
  });
}
