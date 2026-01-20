import { useMutation } from '@tanstack/react-query';

export interface AnalyzePayload {
  listingIds?: string[];
  limit?: number;
  datasetId?: string;
}

export interface AnalyzeResponse {
  status: string;
  message: string;
}

async function triggerAnalyze(payload: AnalyzePayload): Promise<AnalyzeResponse> {
  const response = await fetch('/api/analyze/trigger', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const data = await response.json();
    throw new Error(data.error || 'Failed to trigger analysis');
  }

  return response.json();
}

export function useTriggerAnalyze() {
  return useMutation({
    mutationFn: triggerAnalyze,
  });
}
