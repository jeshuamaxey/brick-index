// Backend page for sanitize action

'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { useTriggerSanitize } from '@/hooks/use-sanitize';
import { useToast } from '@/hooks/use-toast';
import { ActionPageHeader } from '@/components/backend/action-page-header';
import { InngestPayloadCard } from '@/components/backend/inngest-payload-card';

export default function SanitizePage() {
  const router = useRouter();
  const { toast } = useToast();
  const [limit, setLimit] = useState('');
  const [listingIds, setListingIds] = useState('');
  const [limitError, setLimitError] = useState('');

  const triggerSanitize = useTriggerSanitize();

  // Generate JSON payload for Inngest
  const inngestPayload = useMemo(() => {
    const payload: {
      listingIds?: string[];
      limit?: number;
    } = {};

    if (listingIds.trim()) {
      const ids = listingIds
        .split(/[,\n]/)
        .map((id) => id.trim())
        .filter((id) => id.length > 0);
      if (ids.length > 0) {
        payload.listingIds = ids;
      }
    }

    if (limit.trim()) {
      const limitNum = parseInt(limit, 10);
      if (!isNaN(limitNum) && limitNum > 0) {
        payload.limit = limitNum;
      }
    }

    return {
      name: 'job/sanitize.triggered',
      data: payload,
    };
  }, [limit, listingIds]);

  const validateForm = (): boolean => {
    let isValid = true;
    setLimitError('');

    if (limit.trim()) {
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
        .split(/[,\n]/)
        .map((id) => id.trim())
        .filter((id) => id.length > 0);
      if (ids.length > 0) {
        payload.listingIds = ids;
      }
    }

    if (limit.trim()) {
      const limitNum = parseInt(limit, 10);
      if (!isNaN(limitNum) && limitNum > 0) {
        payload.limit = limitNum;
      }
    }

    triggerSanitize.mutate(payload, {
      onSuccess: () => {
        toast({
          title: 'Sanitize job started',
          description: 'The sanitize job has been triggered successfully.',
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
          title: 'Failed to trigger sanitize job',
          description: error.message,
          variant: 'destructive',
        });
      },
    });
  };

  return (
    <div className="p-8 bg-background">
      <ActionPageHeader title="Sanitize" />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Sanitize</CardTitle>
            <CardDescription>
              Sanitizes listing title and description fields by removing HTML markup, images, 
              scripts, and styles. Converts HTML to clean plain text while preserving text structure. 
              Processes all unsanitized listings by default.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="listingIds">Listing IDs (optional)</Label>
              <Textarea
                id="listingIds"
                value={listingIds}
                onChange={(e) => setListingIds(e.target.value)}
                placeholder="Enter listing IDs, one per line or comma-separated"
                rows={4}
                className="font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">
                Specific listing IDs to sanitize. Leave empty to process all unsanitized listings. 
                You can enter IDs separated by commas or newlines.
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
                  Maximum number of listings to sanitize. Leave empty to process all unsanitized listings.
                </p>
              )}
            </div>
          </CardContent>
          <CardFooter>
            <Button
              onClick={handleSubmit}
              disabled={triggerSanitize.isPending}
              className="w-full"
            >
              {triggerSanitize.isPending ? 'Sanitizing...' : 'Sanitize Listings'}
            </Button>
          </CardFooter>
        </Card>

        <InngestPayloadCard payload={inngestPayload} />
      </div>
    </div>
  );
}
