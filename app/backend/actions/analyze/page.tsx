// Backend page for analyze action

'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
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

  const { data: status, isLoading: loadingStatus } = useBackendStatus();
  const triggerAnalyze = useTriggerAnalyze();

  // Generate JSON payload for Inngest
  const inngestPayload = useMemo(() => {
    const payload: {
      listingIds?: string[];
      limit?: number;
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

    return {
      name: 'job/analyze.triggered',
      data: payload,
    };
  }, [limit, listingIds]);

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
