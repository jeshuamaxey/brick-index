// Backend page for analyze action

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

export default function AnalyzePage() {
  const [loadingAction, setLoadingAction] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<StatusData | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [limit, setLimit] = useState('');
  const [listingIds, setListingIds] = useState('');

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

  const triggerAnalyze = async () => {
    try {
      setLoadingAction(true);
      setError(null);
      setResult(null);

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
  };

  return (
    <div className="p-8 bg-background">
      <h1 className="text-2xl font-bold mb-6 text-foreground">Analyze</h1>

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
                onChange={(e) => setLimit(e.target.value)}
                placeholder="Leave empty to process all"
                min="1"
                disabled={!!listingIds.trim()}
              />
              <p className="text-xs text-muted-foreground">
                Maximum number of unanalyzed listings to process. Ignored if listing IDs are provided.
              </p>
            </div>
          </CardContent>
          <CardFooter>
            <Button
              onClick={triggerAnalyze}
              disabled={loadingAction}
              className="w-full"
            >
              {loadingAction ? 'Analyzing...' : 'Trigger Analyze'}
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
