import { useQuery, useMutation } from '@tanstack/react-query';

export interface LegoSetsCountResponse {
  count: number;
}

export interface ReconcilePayload {
  listingIds?: string[];
  limit?: number;
  rerun?: boolean;
  datasetId?: string;
}

export interface ReconcileResponse {
  status: string;
  message: string;
  jobId?: string;
}

async function fetchLegoSetsCount(): Promise<LegoSetsCountResponse> {
  const response = await fetch('/api/catalog/count');
  
  if (!response.ok) {
    throw new Error('Failed to fetch LEGO sets count');
  }

  return response.json();
}

async function triggerReconcile(payload: ReconcilePayload): Promise<ReconcileResponse> {
  const response = await fetch('/api/reconcile/trigger', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const data = await response.json();
    throw new Error(data.error || 'Failed to trigger reconcile');
  }

  return response.json();
}

export function useLegoSetsCount() {
  return useQuery({
    queryKey: ['lego-sets-count'],
    queryFn: fetchLegoSetsCount,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes since catalog doesn't change often
  });
}

export function useReconcile() {
  return useMutation({
    mutationFn: triggerReconcile,
  });
}
