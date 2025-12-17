// Backend page for enrich action

'use client';

import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button"
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

      const response = await fetch('/api/capture/enrich', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          marketplace: 'ebay',
        }),
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

  return (
    <div className="p-8 bg-background">
      <h1 className="text-2xl font-bold mb-6 text-foreground">Enrich</h1>

      <Card>
        <CardHeader>
          <CardTitle>Enrich</CardTitle>
          <CardDescription>
            Enriches unenriched listings with detailed data from the eBay Browse API. 
            Fetches descriptions, images, condition details, and other metadata to enhance 
            the listing information in the database.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!loadingStatus && status && (
            <p className="text-sm text-muted-foreground">
              {status.enrichment.unenriched} out of {status.enrichment.total} listings not enriched.
            </p>
          )}
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
