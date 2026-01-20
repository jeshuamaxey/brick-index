// Backend page for enrich action

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
import type { Dataset } from '@/lib/types';
import { useTriggerEnrich } from '@/hooks/use-enrich';
import { useBackendStatus } from '@/hooks/use-backend-status';
import { useToast } from '@/hooks/use-toast';
import { ActionPageHeader } from '@/components/backend/action-page-header';
import { InngestPayloadCard } from '@/components/backend/inngest-payload-card';

export default function EnrichPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [limit, setLimit] = useState('');
  const [delayMs, setDelayMs] = useState('200');
  const [limitError, setLimitError] = useState('');
  const [delayError, setDelayError] = useState('');
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [selectedDatasetId, setSelectedDatasetId] = useState<string | undefined>(undefined);
  const [loadingDatasets, setLoadingDatasets] = useState(false);

  const { data: status, isLoading: loadingStatus } = useBackendStatus();
  const triggerEnrich = useTriggerEnrich();

  // Fetch datasets on mount
  useEffect(() => {
    const fetchDatasets = async () => {
      setLoadingDatasets(true);
      try {
        const response = await fetch('/api/datasets');
        if (response.ok) {
          const data = await response.json();
          setDatasets(data);
        }
      } catch (error) {
        console.error('Error fetching datasets:', error);
      } finally {
        setLoadingDatasets(false);
      }
    };

    fetchDatasets();
  }, []);

  // Generate JSON payload for Inngest
  const inngestPayload = useMemo(() => {
    const payload: {
      marketplace: string;
      limit?: number;
      delayMs?: number;
      datasetId?: string;
    } = {
      marketplace: 'ebay',
    };

    if (limit) {
      const limitNum = parseInt(limit, 10);
      if (!isNaN(limitNum) && limitNum > 0) {
        payload.limit = limitNum;
      }
    }

    if (delayMs) {
      const delayNum = parseInt(delayMs, 10);
      if (!isNaN(delayNum) && delayNum >= 0) {
        payload.delayMs = delayNum;
      }
    }

    if (selectedDatasetId) {
      payload.datasetId = selectedDatasetId;
    }

    return {
      name: 'job/enrich.triggered',
      data: payload,
    };
  }, [limit, delayMs, selectedDatasetId]);

  const validateForm = (): boolean => {
    let isValid = true;
    setLimitError('');
    setDelayError('');

    if (limit) {
      const limitNum = parseInt(limit, 10);
      if (isNaN(limitNum) || limitNum <= 0) {
        setLimitError('Limit must be a positive number');
        isValid = false;
      }
    }

    if (delayMs) {
      const delayNum = parseInt(delayMs, 10);
      if (isNaN(delayNum) || delayNum < 0) {
        setDelayError('Delay must be a non-negative number');
        isValid = false;
      }
    }

    return isValid;
  };

  const handleSubmit = () => {
    if (!validateForm()) {
      return;
    }

    const payload: {
      marketplace: string;
      limit?: number;
      delayMs?: number;
      datasetId?: string;
    } = {
      marketplace: 'ebay',
    };

    if (limit) {
      const limitNum = parseInt(limit, 10);
      if (!isNaN(limitNum) && limitNum > 0) {
        payload.limit = limitNum;
      }
    }

    if (delayMs) {
      const delayNum = parseInt(delayMs, 10);
      if (!isNaN(delayNum) && delayNum >= 0) {
        payload.delayMs = delayNum;
      }
    }

    if (selectedDatasetId) {
      payload.datasetId = selectedDatasetId;
    }

    triggerEnrich.mutate(payload, {
      onSuccess: () => {
        toast({
          title: 'Enrich job started',
          description: 'The enrichment job has been triggered successfully.',
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
          title: 'Failed to trigger enrich job',
          description: error.message,
          variant: 'destructive',
        });
      },
    });
  };

  return (
    <div className="p-8 bg-background">
      <ActionPageHeader title="Enrich" />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Enrich</CardTitle>
            <CardDescription>
              Enriches unenriched listings with detailed data from the eBay Browse API. 
              Fetches descriptions, images, condition details, and other metadata to enhance 
              the listing information in the database.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!loadingStatus && status && (
              <p className="text-sm text-muted-foreground">
                {status.enrichment.unenriched} out of {status.enrichment.total} listings not enriched.
              </p>
            )}

            <div className="space-y-2">
              <Label htmlFor="dataset">Dataset (optional)</Label>
              <Select 
                value={selectedDatasetId || undefined} 
                onValueChange={(value) => setSelectedDatasetId(value || undefined)}
              >
                <SelectTrigger id="dataset" className="w-full">
                  <SelectValue placeholder="Select a dataset (optional)" />
                </SelectTrigger>
                <SelectContent>
                  {datasets.map((dataset) => (
                    <SelectItem key={dataset.id} value={dataset.id}>
                      {dataset.name}
                      {dataset.listing_count !== undefined && ` (${dataset.listing_count} listings)`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Optional. If selected, only enriches listings from this dataset. Leave unselected to process all listings.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="limit">Limit (optional)</Label>
              <Input
                id="limit"
                type="number"
                value={limit}
                onChange={(e) => {
                  setLimit(e.target.value);
                  setLimitError('');
                }}
                placeholder="Leave empty to process all"
                min="1"
                className={limitError ? 'border-destructive' : ''}
              />
              {limitError && (
                <p className="text-xs text-destructive">{limitError}</p>
              )}
              {!limitError && (
                <p className="text-xs text-muted-foreground">
                  Maximum number of listings to enrich. Leave empty to process all unenriched listings.
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="delayMs">Delay (ms)</Label>
              <Input
                id="delayMs"
                type="number"
                value={delayMs}
                onChange={(e) => {
                  setDelayMs(e.target.value);
                  setDelayError('');
                }}
                placeholder="200"
                min="0"
                className={delayError ? 'border-destructive' : ''}
              />
              {delayError && (
                <p className="text-xs text-destructive">{delayError}</p>
              )}
              {!delayError && (
                <p className="text-xs text-muted-foreground">
                  Delay in milliseconds between API calls to prevent rate limiting.
                </p>
              )}
            </div>
          </CardContent>
          <CardFooter>
            <Button
              onClick={handleSubmit}
              disabled={triggerEnrich.isPending}
              className="w-full"
            >
              {triggerEnrich.isPending ? 'Enriching...' : 'Trigger Enrich'}
            </Button>
          </CardFooter>
        </Card>

        <InngestPayloadCard payload={inngestPayload} />
      </div>
    </div>
  );
}
