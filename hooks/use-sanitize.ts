import { useMutation } from '@tanstack/react-query';

export interface SanitizePayload {
  listingIds?: string[];
  limit?: number;
  datasetId?: string;
}

export interface SanitizeResponse {
  status: string;
  message: string;
}

async function triggerSanitize(payload: SanitizePayload): Promise<SanitizeResponse> {
  const response = await fetch('/api/sanitize/trigger', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const data = await response.json();
    throw new Error(data.error || 'Failed to trigger sanitize');
  }

  return response.json();
}

export function useTriggerSanitize() {
  return useMutation({
    mutationFn: triggerSanitize,
  });
}
