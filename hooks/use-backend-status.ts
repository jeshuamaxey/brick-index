import { useQuery } from '@tanstack/react-query';

export interface BackendStatusData {
  lastCaptureJob: string | null;
  enrichment: {
    total: number;
    unenriched: number;
  };
  analysis: {
    total: number;
    unanalyzed: number;
  };
}

async function fetchBackendStatus(): Promise<BackendStatusData> {
  const response = await fetch('/api/backend/status');
  
  if (!response.ok) {
    throw new Error('Failed to fetch backend status');
  }

  return response.json();
}

export function useBackendStatus() {
  return useQuery({
    queryKey: ['backend-status'],
    queryFn: fetchBackendStatus,
    staleTime: 30 * 1000, // Cache for 30 seconds
  });
}
