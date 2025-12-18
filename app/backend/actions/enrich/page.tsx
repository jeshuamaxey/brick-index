// Backend page for enrich action

'use client';

import { useState, useEffect } from 'react';
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

interface StatusData {
  lastCaptureJob: string | null;
  enrichment: {
    total: number;
    unenriched: number;
  };
  analysis: {
    total: number;
    unanalyzed: number;
  };
}

export default function EnrichPage() {
  const [loadingAction, setLoadingAction] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<StatusData | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [limit, setLimit] = useState('');
  const [delayMs, setDelayMs] = useState('200');

  useEffect(() => {
    fetchStatus();
  }, []);

  const fetchStatus = async () => {
    try {
      setLoadingStatus(true);
      const response = await fetch('/api/backend/status');
      if (!response.ok) {
        throw new Error('Failed to fetch status');
      }
      const data = await response.json();
      setStatus(data);
    } catch (err) {
      console.error('Error fetching status:', err);
    } finally {
      setLoadingStatus(false);
    }
  };

  const triggerEnrich = async () => {
    try {
      setLoadingAction(true);
      setError(null);
      setResult(null);

      const payload: {
        marketplace: string;
        limit?: number;
        delayMs?: number;
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

      const data = await response.json();
      setResult(data);
      // Refresh status after action
      fetchStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoadingAction(false);
    }
  };

  // Generate JSON payload for Inngest
  const generateInngestPayload = () => {
    const payload: {
      marketplace: string;
      limit?: number;
      delayMs?: number;
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

    return {
      name: 'job/enrich.triggered',
      data: payload,
    };
  };

  return (
    <div className="p-8 bg-background">
      <h1 className="text-2xl font-bold mb-6 text-foreground">Enrich</h1>

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
              <Label htmlFor="limit">Limit (optional)</Label>
              <Input
                id="limit"
                type="number"
                value={limit}
                onChange={(e) => setLimit(e.target.value)}
                placeholder="Leave empty to process all"
                min="1"
              />
              <p className="text-xs text-muted-foreground">
                Maximum number of listings to enrich. Leave empty to process all unenriched listings.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="delayMs">Delay (ms)</Label>
              <Input
                id="delayMs"
                type="number"
                value={delayMs}
                onChange={(e) => setDelayMs(e.target.value)}
                placeholder="200"
                min="0"
              />
              <p className="text-xs text-muted-foreground">
                Delay in milliseconds between API calls to prevent rate limiting.
              </p>
            </div>
          </CardContent>
          <CardFooter>
            <Button
              onClick={triggerEnrich}
              disabled={loadingAction}
              className="w-full"
            >
              {loadingAction ? 'Enriching...' : 'Trigger Enrich'}
            </Button>
          </CardFooter>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Inngest Event Payload</CardTitle>
            <CardDescription>
              Copy this JSON to paste into Inngest's event trigger. Use the <code>data</code> field value.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <pre className="text-xs bg-muted p-4 rounded-md overflow-auto max-h-[600px]">
              {JSON.stringify(generateInngestPayload(), null, 2)}
            </pre>
          </CardContent>
          <CardFooter>
            <Button
              variant="outline"
              onClick={() => {
                navigator.clipboard.writeText(JSON.stringify(generateInngestPayload().data, null, 2));
              }}
              className="w-full"
            >
              Copy Data Field
            </Button>
          </CardFooter>
        </Card>
      </div>

      {error && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Error</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-destructive">{error}</p>
          </CardContent>
        </Card>
      )}

      {result && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Result</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="text-sm text-foreground overflow-auto">
              {JSON.stringify(result, null, 2)}
            </pre>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
