// Backend page for reconcile action

'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { useReconcile } from '@/hooks/use-reconcile';
import { useToast } from '@/hooks/use-toast';
import { ActionPageHeader } from '@/components/backend/action-page-header';
import { InngestPayloadCard } from '@/components/backend/inngest-payload-card';

export default function ReconcilePage() {
  const router = useRouter();
  const { toast } = useToast();
  const [limit, setLimit] = useState('');
  const [listingIds, setListingIds] = useState('');
  const [rerun, setRerun] = useState(false);
  const [limitError, setLimitError] = useState('');

  const triggerReconcile = useReconcile();

  // Generate JSON payload for Inngest
  const inngestPayload = useMemo(() => {
    const payload: {
      listingIds?: string[];
      limit?: number;
      rerun?: boolean;
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

    if (rerun) {
      payload.rerun = true;
    }

    return {
      name: 'job/reconcile.triggered',
      data: payload,
    };
  }, [limit, listingIds, rerun]);

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
      rerun?: boolean;
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

    if (rerun) {
      payload.rerun = true;
    }

    triggerReconcile.mutate(payload, {
      onSuccess: () => {
        toast({
          title: 'Reconcile job started',
          description: 'The reconcile job has been triggered successfully.',
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
          title: 'Failed to trigger reconcile job',
          description: error.message,
          variant: 'destructive',
        });
      },
    });
  };

  return (
    <div className="p-8 bg-background">
      <ActionPageHeader title="Reconcile" />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Reconcile</CardTitle>
            <CardDescription>
              Extracts LEGO set IDs from listing titles and descriptions, validates them against 
              the catalog, and creates join records linking listings to LEGO sets.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="listingIds">Listing IDs (comma-separated, optional)</Label>
                <Input
                  id="listingIds"
                  type="text"
                  value={listingIds}
                  onChange={(e) => setListingIds(e.target.value)}
                  placeholder="123e4567-e89b-12d3-a456-426614174000, 223e4567-e89b-12d3-a456-426614174001"
                />
                <p className="text-xs text-muted-foreground">
                  Optional. If provided, only these listings will be reconciled. If not provided, 
                  all analyzed listings will be processed.
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
                  placeholder="500"
                  min="1"
                  disabled={!!listingIds.trim()}
                  className={limitError ? 'border-destructive' : ''}
                />
                {limitError && (
                  <p className="text-xs text-destructive">{limitError}</p>
                )}
                {!limitError && (
                  <p className="text-xs text-muted-foreground">
                    Optional. Maximum number of analyzed listings to process. Ignored if listing IDs are provided.
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="rerun"
                    checked={rerun}
                    onCheckedChange={(checked) => setRerun(checked === true)}
                  />
                  <Label htmlFor="rerun" className="text-sm font-normal cursor-pointer">
                    Rerun reconciliation
                  </Label>
                </div>
                <p className="text-xs text-muted-foreground ml-6">
                  If enabled, will also process listings that were already reconciled with the current version. 
                  Useful for re-running reconciliation on listings that were previously processed.
                </p>
              </div>
            </div>
          </CardContent>
          <CardFooter>
            <Button
              onClick={handleSubmit}
              disabled={triggerReconcile.isPending}
              className="w-full"
            >
              {triggerReconcile.isPending ? 'Triggering...' : 'Trigger Reconcile'}
            </Button>
          </CardFooter>
        </Card>

        <InngestPayloadCard payload={inngestPayload} />
      </div>
    </div>
  );
}
