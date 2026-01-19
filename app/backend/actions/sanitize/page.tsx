// Backend page for sanitize action (placeholder)

'use client';

import { useState } from 'react';
import { Button } from "@/components/ui/button"
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

  const triggerSanitize = async () => {
    try {
      setLoadingAction(true);
      setError(null);
      setResult(null);

      const response = await fetch('/api/sanitize/trigger', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
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

  return (
    <div className="p-8 bg-background">
      <h1 className="text-2xl font-bold mb-6 text-foreground">Sanitize</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Sanitize</CardTitle>
            <CardDescription>
              Sanitizes listing data to prepare it for analysis. This job is currently a placeholder 
              and does not perform any business logic. It will complete immediately when triggered.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-md p-4">
              <p className="text-sm text-yellow-800 dark:text-yellow-200">
                <strong>Note:</strong> This is a placeholder job. The business logic for sanitization 
                has not been implemented yet. When triggered, the job will complete immediately 
                without performing any actual work.
              </p>
            </div>
          </CardContent>
          <CardFooter>
            <Button
              onClick={triggerSanitize}
              disabled={loadingAction}
              className="w-full"
            >
              {loadingAction ? 'Triggering...' : 'Trigger Sanitize'}
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
