import { useMutation } from '@tanstack/react-query';
import type { EbaySearchParams } from '@/lib/capture/marketplace-adapters/ebay-adapter';

export interface CapturePayload {
  marketplace: string;
  keywords: string[];
  ebayParams?: EbaySearchParams;
  datasetName?: string;
}

export interface CaptureResponse {
  status: string;
  message: string;
}

async function triggerCapture(payload: CapturePayload): Promise<CaptureResponse> {
  const response = await fetch('/api/capture/trigger', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const data = await response.json();
    throw new Error(data.error || 'Failed to trigger capture');
  }

  return response.json();
}

export function useTriggerCapture() {
  return useMutation({
    mutationFn: triggerCapture,
  });
}
