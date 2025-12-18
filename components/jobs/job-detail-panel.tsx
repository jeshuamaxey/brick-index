'use client';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Label } from '@/components/ui/label';
import { Copy, ChevronDown, ChevronUp, X } from 'lucide-react';
import { useState } from 'react';

interface Job {
  id: string;
  type: string;
  marketplace: string;
  status: 'running' | 'completed' | 'failed';
  listings_found: number;
  listings_new: number;
  listings_updated: number;
  started_at: string;
  completed_at: string | null;
  updated_at: string | null;
  last_update: string | null;
  error_message: string | null;
  metadata?: Record<string, unknown>;
}

interface JobDetailPanelProps {
  job: Job;
  onCancelJob?: (jobId: string) => void;
}

export function JobDetailPanel({ job, onCancelJob }: JobDetailPanelProps) {
  const [isMetadataOpen, setIsMetadataOpen] = useState(false);

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A';
    try {
      return new Date(dateString).toLocaleString();
    } catch {
      return dateString;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'running':
        return 'bg-yellow-500/20 text-yellow-600 dark:text-yellow-400 border border-yellow-500/30';
      case 'completed':
        return 'bg-green-500/20 text-green-600 dark:text-green-400 border border-green-500/30';
      case 'failed':
        return 'bg-red-500/20 text-red-600 dark:text-red-400 border border-red-500/30';
      default:
        return 'bg-foreground/10 text-foreground border border-foreground/20';
    }
  };

  const getTypeDisplay = (type: string) => {
    return type.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
    }
  };

  const getResultsDisplay = () => {
    if (job.type.includes('refresh')) {
      return {
        found: job.listings_found,
        new: job.listings_new,
        updated: job.listings_updated,
        labels: { found: 'Found', new: 'New', updated: 'Updated' },
      };
    } else if (job.type.includes('enrich')) {
      return {
        found: job.listings_found,
        new: job.listings_new,
        updated: job.listings_updated,
        labels: { found: 'Total', new: 'Succeeded', updated: 'Failed' },
      };
    } else if (job.type.includes('analyze')) {
      return {
        found: job.listings_found,
        new: job.listings_new,
        updated: job.listings_updated,
        labels: { found: 'Total', new: 'Analyzed', updated: 'Failed' },
      };
    }
    return null;
  };

  const results = getResultsDisplay();

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <div className="space-y-4">
        {/* Basic Information */}
        <Card>
          <CardHeader>
            <CardTitle>Basic Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">Job ID</Label>
              <div className="flex items-center gap-2">
                <span className="text-sm font-mono text-foreground/70">{job.id}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0"
                  onClick={() => copyToClipboard(job.id)}
                  title="Copy ID"
                >
                  <Copy className="h-3 w-3" />
                </Button>
              </div>
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">Type</Label>
              <span className="text-sm text-foreground">{getTypeDisplay(job.type)}</span>
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">Marketplace</Label>
              <span className="text-sm text-foreground">{job.marketplace}</span>
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">Status</Label>
              <span
                className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(
                  job.status
                )}`}
              >
                {job.status}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Timestamps */}
        <Card>
          <CardHeader>
            <CardTitle>Timestamps</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">Started At</Label>
              <span className="text-sm text-foreground/70">{formatDate(job.started_at)}</span>
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">Completed At</Label>
              <span className="text-sm text-foreground/70">
                {formatDate(job.completed_at)}
              </span>
            </div>
            {job.updated_at && (
              <>
                <Separator />
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium">Last Updated</Label>
                  <span className="text-sm text-foreground/70">
                    {formatDate(job.updated_at)}
                  </span>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Progress */}
        {job.last_update && (
          <Card>
            <CardHeader>
              <CardTitle>Progress</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="text-sm font-medium text-foreground">{job.last_update}</div>
                {job.updated_at && (
                  <div className="text-xs text-foreground/60">
                    Last update: {formatDate(job.updated_at)}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Results */}
        {results && (
          <Card>
            <CardHeader>
              <CardTitle>Results</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">{results.labels.found}</Label>
                <span className="text-sm font-semibold text-foreground">
                  {results.found.toLocaleString()}
                </span>
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">{results.labels.new}</Label>
                <span className="text-sm font-semibold text-foreground">
                  {results.new.toLocaleString()}
                </span>
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">{results.labels.updated}</Label>
                <span className="text-sm font-semibold text-foreground">
                  {results.updated.toLocaleString()}
                </span>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Error Message */}
        {job.error_message && (
          <Card>
            <CardHeader>
              <CardTitle className="text-destructive">Error</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded p-3">
                {job.error_message}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Metadata */}
        {job.metadata && Object.keys(job.metadata).length > 0 && (
          <Card>
            <Collapsible open={isMetadataOpen} onOpenChange={setIsMetadataOpen}>
              <CardHeader>
                <CollapsibleTrigger className="flex items-center justify-between w-full">
                  <CardTitle>Metadata</CardTitle>
                  {isMetadataOpen ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                </CollapsibleTrigger>
              </CardHeader>
              <CollapsibleContent>
                <CardContent>
                  <pre className="text-xs bg-foreground/5 rounded p-3 overflow-x-auto">
                    {JSON.stringify(job.metadata, null, 2)}
                  </pre>
                </CardContent>
              </CollapsibleContent>
            </Collapsible>
          </Card>
        )}

        {/* Actions */}
        {job.status === 'running' && onCancelJob && (
          <Card>
            <CardContent className="pt-6">
              <Button
                variant="destructive"
                onClick={() => {
                  if (confirm('Are you sure you want to cancel this job?')) {
                    onCancelJob(job.id);
                  }
                }}
                className="w-full"
              >
                <X className="h-4 w-4 mr-2" />
                Cancel Job
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
