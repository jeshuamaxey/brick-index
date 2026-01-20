// Backend page for analyze action

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
import { useTriggerAnalyze } from '@/hooks/use-analyze';
import { useBackendStatus } from '@/hooks/use-backend-status';
import { useToast } from '@/hooks/use-toast';
import { ActionPageHeader } from '@/components/backend/action-page-header';
import { InngestPayloadCard } from '@/components/backend/inngest-payload-card';

export default function AnalyzePage() {
  const router = useRouter();
  const { toast } = useToast();
  const [limit, setLimit] = useState('');
  const [listingIds, setListingIds] = useState('');
  const [limitError, setLimitError] = useState('');
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [selectedDatasetId, setSelectedDatasetId] = useState<string | undefined>(undefined);
  const [loadingDatasets, setLoadingDatasets] = useState(false);

  const { data: status, isLoading: loadingStatus } = useBackendStatus();
  const triggerAnalyze = useTriggerAnalyze();

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
      listingIds?: string[];
      limit?: number;
      datasetId?: string;
    } = {};

    if (listingIds.trim()) {
      const ids = listingIds
        .split(',')
        .map((id) => id.trim())
        .filter((id) => id.length > 0);
      if (ids.length > 0) {
        payload.listingIds = ids;
      }
    }

    if (limit && !payload.listingIds) {
      const limitNum = parseInt(limit, 10);
      if (!isNaN(limitNum) && limitNum > 0) {
        payload.limit = limitNum;
      }
    }

    if (selectedDatasetId) {
      payload.datasetId = selectedDatasetId;
    }

    return {
      name: 'job/analyze.triggered',
      data: payload,
    };
  }, [limit, listingIds, selectedDatasetId]);

  const validateForm = (): boolean => {
    let isValid = true;
    setLimitError('');

    if (limit && !listingIds.trim()) {
      const limitNum = parseInt(limit, 10);
      if (isNaN(limitNum) || limitNum <= 0) {
        setLimitError('Limit must be a positive number');
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
      listingIds?: string[];
      limit?: number;
      datasetId?: string;
    } = {};

    if (listingIds.trim()) {
      const ids = listingIds
        .split(',')
        .map((id) => id.trim())
        .filter((id) => id.length > 0);
      if (ids.length > 0) {
        payload.listingIds = ids;
      }
    }

    if (limit && !payload.listingIds) {
      const limitNum = parseInt(limit, 10);
      if (!isNaN(limitNum) && limitNum > 0) {
        payload.limit = limitNum;
      }
    }

    if (selectedDatasetId) {
      payload.datasetId = selectedDatasetId;
    }

    triggerAnalyze.mutate(payload, {
      onSuccess: () => {
        toast({
          title: 'Analyze job started',
          description: 'The analysis job has been triggered successfully.',
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
          title: 'Failed to trigger analyze job',
          description: error.message,
          variant: 'destructive',
        });
      },
    });
  };

  return (
    <div className="p-8 bg-background">
      <ActionPageHeader title="Analyze" />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Analyze</CardTitle>
            <CardDescription>
              Analyzes listings to extract piece count, minifig count, condition, and calculate 
              price per piece from listing titles and descriptions. Processes all unanalyzed 
              listings by default.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!loadingStatus && status && (
              <p className="text-sm text-muted-foreground">
                {status.analysis.unanalyzed} out of {status.analysis.total} listings not analyzed.
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
                Optional. If selected, only analyzes listings from this dataset. Ignored if listing IDs are provided. Leave unselected to process all listings.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="listingIds">Listing IDs (optional, comma-separated)</Label>
              <Input
                id="listingIds"
                type="text"
                value={listingIds}
                onChange={(e) => setListingIds(e.target.value)}
                placeholder="Leave empty to analyze all unanalyzed listings"
                disabled={!!limit.trim()}
              />
              <p className="text-xs text-muted-foreground">
                Specific listing IDs to analyze. If provided, only these listings will be analyzed.
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
                disabled={!!listingIds.trim()}
                className={limitError ? 'border-destructive' : ''}
              />
              {limitError && (
                <p className="text-xs text-destructive">{limitError}</p>
              )}
              {!limitError && (
                <p className="text-xs text-muted-foreground">
                  Maximum number of unanalyzed listings to process. Ignored if listing IDs are provided.
                </p>
              )}
            </div>
          </CardContent>
          <CardFooter>
            <Button
              onClick={handleSubmit}
              disabled={triggerAnalyze.isPending}
              className="w-full"
            >
              {triggerAnalyze.isPending ? 'Analyzing...' : 'Trigger Analyze'}
            </Button>
          </CardFooter>
        </Card>

        <InngestPayloadCard payload={inngestPayload} />
      </div>
    </div>
  );
}
