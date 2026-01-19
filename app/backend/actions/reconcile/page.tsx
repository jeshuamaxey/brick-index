// Backend page for reconcile action

'use client';

import { useState } from 'react';
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

export default function ReconcilePage() {
  const [loadingAction, setLoadingAction] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [limit, setLimit] = useState('');
  const [listingIds, setListingIds] = useState('');

  const triggerReconcile = async () => {
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

      const response = await fetch('/api/reconcile/trigger', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to trigger reconcile');
      }

      const data = await response.json();
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoadingAction(false);
    }
  };

  return (
    <div className="p-8 bg-background">
      <h1 className="text-2xl font-bold mb-6 text-foreground">Reconcile</h1>

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
                  onChange={(e) => setLimit(e.target.value)}
                  placeholder="500"
                  min="1"
                />
                <p className="text-xs text-muted-foreground">
                  Optional. Maximum number of analyzed listings to process. Ignored if listing IDs are provided.
                </p>
              </div>
            </div>
          </CardContent>
          <CardFooter>
            <Button
              onClick={triggerReconcile}
              disabled={loadingAction}
              className="w-full"
            >
              {loadingAction ? 'Triggering...' : 'Trigger Reconcile'}
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
