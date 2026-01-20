import { useMutation } from '@tanstack/react-query';

export interface EnrichPayload {
  marketplace: string;
  limit?: number;
  delayMs?: number;
  datasetId?: string;
}

export interface EnrichResponse {
  status: string;
  message: string;
}

async function triggerEnrich(payload: EnrichPayload): Promise<EnrichResponse> {
  const response = await fetch('/api/capture/enrich', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const data = await response.json();
    throw new Error(data.error || 'Failed to trigger enrichment');
  }

  return response.json();
}

export function useTriggerEnrich() {
  return useMutation({
    mutationFn: triggerEnrich,
  });
}
