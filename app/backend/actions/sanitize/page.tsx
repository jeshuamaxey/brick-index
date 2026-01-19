// Backend page for sanitize action

'use client';

import { useState } from 'react';
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

export default function SanitizePage() {
  const [loadingAction, setLoadingAction] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [limit, setLimit] = useState('');
  const [listingIds, setListingIds] = useState('');

  const triggerSanitize = async () => {
    try {
      setLoadingAction(true);
      setError(null);
      setResult(null);

      const payload: {
        listingIds?: string[];
        limit?: number;
      } = {};

      // Parse listing IDs if provided (comma-separated or newline-separated)
      if (listingIds.trim()) {
        const ids = listingIds
          .split(/[,\n]/)
          .map((id) => id.trim())
          .filter((id) => id.length > 0);
        if (ids.length > 0) {
          payload.listingIds = ids;
        }
      }

      // Parse limit if provided
      if (limit.trim()) {
        const limitNum = parseInt(limit, 10);
        if (!isNaN(limitNum) && limitNum > 0) {
          payload.limit = limitNum;
        }
      }

      const response = await fetch('/api/sanitize/trigger', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to trigger sanitize');
      }

      const data = await response.json();
      setResult(data);
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
  };

  return (
    <div className="p-8 bg-background">
      <h1 className="text-2xl font-bold mb-6 text-foreground">Sanitize</h1>

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
                onChange={(e) => setLimit(e.target.value)}
                placeholder="Leave empty to process all"
                min="1"
              />
              <p className="text-xs text-muted-foreground">
                Maximum number of listings to sanitize. Leave empty to process all unsanitized listings.
              </p>
            </div>
          </CardContent>
          <CardFooter>
            <Button
              onClick={triggerSanitize}
              disabled={loadingAction}
              className="w-full"
            >
              {loadingAction ? 'Sanitizing...' : 'Sanitize Listings'}
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
