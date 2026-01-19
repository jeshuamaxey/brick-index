'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ListingAnalysisItem } from '@/components/reconcile/listing-analysis-item';
import { RegexPatternService } from '@/lib/analyze/regex-pattern-service';
import { ArrowLeft, Copy, Download } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';

interface ExtractedId {
  extractedId: string;
  validated: boolean;
}

interface Listing {
  listingId: string;
  title: string;
  description: string | null;
  sanitisedTitle?: string | null;
  sanitisedDescription?: string | null;
  extractedIds: ExtractedId[];
}

interface Job {
  id: string;
  type: string;
  status: string;
  reconciliationVersion?: string;
  metadata?: {
    total_listings_input?: number;
    distribution?: Record<string, number>;
    extracted_ids?: {
      total_extracted?: number;
      total_validated?: number;
      total_not_validated?: number;
    };
  };
}

interface JobResponse {
  job: Job;
  listings?: Listing[];
}

export default function ReconcileAnalysisPage() {
  const params = useParams();
  const router = useRouter();
  const jobId = params.jobId as string;

  const [job, setJob] = useState<Job | null>(null);
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedListingIndex, setSelectedListingIndex] = useState<number>(0);
  const [notes, setNotes] = useState<string>('');
  const notesTextareaRef = useRef<HTMLTextAreaElement>(null);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const selectedListingRef = useRef<HTMLDivElement>(null);

  // Fetch job data
  useEffect(() => {
    const fetchJob = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await fetch(`/api/jobs/${jobId}`);
        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || 'Failed to fetch job');
        }
        const data: JobResponse = await response.json();
        setJob(data.job);
        setListings(data.listings || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    if (jobId) {
      fetchJob();
    }
  }, [jobId]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't handle keyboard shortcuts when typing in textarea
      if (
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLInputElement
      ) {
        return;
      }

      switch (e.key) {
        case 'ArrowUp':
          e.preventDefault();
          setSelectedListingIndex((prev) => Math.max(0, prev - 1));
          break;
        case 'ArrowDown':
          e.preventDefault();
          setSelectedListingIndex((prev) =>
            Math.min(listings.length - 1, prev + 1)
          );
          break;
        case 'Enter':
          e.preventDefault();
          // Focus notes textarea
          if (notesTextareaRef.current) {
            notesTextareaRef.current.focus();
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [listings, selectedListingIndex]);

  // Scroll selected listing into view in sidebar
  useEffect(() => {
    if (selectedListingRef.current && sidebarRef.current) {
      selectedListingRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
      });
    }
  }, [selectedListingIndex]);

  const handleNotesChange = useCallback((newNotes: string) => {
    setNotes(newNotes);
  }, []);

  const handleCopyListingId = useCallback((listingId: string) => {
    setNotes((prev) => {
      const separator = prev && !prev.endsWith('\n') ? '\n' : '';
      return prev + separator + listingId + '\n';
    });
    // Focus the textarea after appending
    setTimeout(() => {
      if (notesTextareaRef.current) {
        notesTextareaRef.current.focus();
        // Scroll to bottom
        notesTextareaRef.current.scrollTop = notesTextareaRef.current.scrollHeight;
      }
    }, 0);
  }, []);

  const exportNotes = useCallback(() => {
    const content = JSON.stringify(
      {
        jobId,
        notes,
        exportedAt: new Date().toISOString(),
      },
      null,
      2
    );
    const blob = new Blob([content], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `reconcile-notes-${jobId}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [notes, jobId]);

  const copyNotes = useCallback(() => {
    navigator.clipboard.writeText(notes);
  }, [notes]);

  if (loading) {
    return (
      <div className="flex flex-col h-full bg-background text-foreground p-4">
        <Skeleton className="h-8 w-64 mb-4" />
        <Skeleton className="h-full w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col h-full bg-background text-foreground p-4">
        <div className="bg-destructive/10 border border-destructive/20 text-destructive px-4 py-3 rounded">
          Error: {error}
        </div>
        <Button onClick={() => router.push('/backend/resources/jobs')} className="mt-4">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Jobs
        </Button>
      </div>
    );
  }

  if (!job || job.type !== 'reconcile') {
    return (
      <div className="flex flex-col h-full bg-background text-foreground p-4">
        <div className="bg-destructive/10 border border-destructive/20 text-destructive px-4 py-3 rounded">
          This is not a reconcile job or job not found.
        </div>
        <Button onClick={() => router.push('/backend/resources/jobs')} className="mt-4">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Jobs
        </Button>
      </div>
    );
  }

  const reconciliationVersion = job.reconciliationVersion || '1.0.0';
  const regexPattern = RegexPatternService.getRegexPattern(reconciliationVersion);
  const selectedListing = listings[selectedListingIndex];

  return (
    <div className="flex flex-col h-full bg-background text-foreground">
      {/* Header */}
      <div className="shrink-0 border-b p-4">
        <div className="flex items-center justify-between">
          <div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push('/backend/resources/jobs')}
              className="mb-2"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Jobs
            </Button>
            <h1 className="text-2xl font-bold">Reconciliation Analysis</h1>
            <p className="text-sm text-muted-foreground">
              Job ID: {jobId.substring(0, 8)}... | Version: {reconciliationVersion}
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={copyNotes}>
              <Copy className="h-4 w-4 mr-2" />
              Copy Notes
            </Button>
            <Button variant="outline" size="sm" onClick={exportNotes}>
              <Download className="h-4 w-4 mr-2" />
              Export Notes
            </Button>
          </div>
        </div>

        {/* Job Summary */}
        {job.metadata && (
          <div className="mt-4 flex gap-4 text-sm">
            {job.metadata.total_listings_input !== undefined && (
              <div>
                <span className="font-medium">Listings:</span>{' '}
                {job.metadata.total_listings_input}
              </div>
            )}
            {job.metadata.extracted_ids?.total_extracted !== undefined && (
              <div>
                <span className="font-medium">Extracted IDs:</span>{' '}
                {job.metadata.extracted_ids.total_extracted}
              </div>
            )}
            {job.metadata.extracted_ids?.total_validated !== undefined && (
              <div>
                <span className="font-medium">Validated:</span>{' '}
                {job.metadata.extracted_ids.total_validated}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Main Content */}
      <div className="flex-1 min-h-0 flex overflow-hidden">
        {/* Sidebar - Listings */}
        <div
          ref={sidebarRef}
          className="w-80 border-r overflow-y-auto bg-muted/20"
        >
          <div className="p-4 sticky top-0 bg-background border-b z-10">
            <h2 className="font-semibold text-sm">
              Listings ({listings.length})
            </h2>
            <p className="text-xs text-muted-foreground mt-1">
              Use ↑/↓ to navigate, Enter to focus notes panel
            </p>
          </div>
          <div className="p-2">
            {listings.length === 0 ? (
              <div className="p-4 text-sm text-muted-foreground text-center">
                No listings found
              </div>
            ) : (
              listings.map((listing, index) => (
                <div
                  key={listing.listingId}
                  ref={index === selectedListingIndex ? selectedListingRef : null}
                  onClick={() => setSelectedListingIndex(index)}
                  className={`p-3 mb-2 rounded border cursor-pointer transition-colors ${
                    index === selectedListingIndex
                      ? 'bg-primary/10 border-primary'
                      : 'bg-background hover:bg-muted/50'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {listing.title || 'No title'}
                      </p>
                      <div className="flex gap-1 mt-1 flex-wrap">
                        <Badge variant="outline" className="text-xs">
                          {listing.extractedIds.length} ID
                          {listing.extractedIds.length !== 1 ? 's' : ''}
                        </Badge>
                        {listing.extractedIds.filter((e) => e.validated).length >
                          0 && (
                          <Badge variant="default" className="text-xs">
                            {listing.extractedIds.filter((e) => e.validated)
                              .length}{' '}
                            validated
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Main Content - Selected Listing */}
        <div className="flex-1 overflow-y-auto p-4">
          {selectedListing ? (
            <ListingAnalysisItem
              listingId={selectedListing.listingId}
              title={selectedListing.title}
              description={selectedListing.description}
              sanitisedTitle={selectedListing.sanitisedTitle}
              sanitisedDescription={selectedListing.sanitisedDescription}
              extractedIds={selectedListing.extractedIds}
              regexPattern={regexPattern}
              onCopyListingId={handleCopyListingId}
            />
          ) : (
            <Card>
              <CardContent className="p-6 text-center text-muted-foreground">
                Select a listing from the sidebar
              </CardContent>
            </Card>
          )}
        </div>

        {/* Notes Panel - Right Side */}
        <div className="w-96 border-l overflow-hidden flex flex-col bg-muted/10">
          <div className="p-4 border-b shrink-0">
            <h2 className="font-semibold text-sm mb-1">Notes</h2>
            <p className="text-xs text-muted-foreground">
              Write feedback for all listings here. Click "Copy ID" on listings to append their IDs.
            </p>
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            <div className="space-y-2">
              <Label htmlFor="notes-textarea" className="text-sm font-medium">
                Feedback & Observations
              </Label>
              <Textarea
                id="notes-textarea"
                ref={notesTextareaRef}
                placeholder="Add your observations about regex matches, false positives, false negatives, etc. Click 'Copy ID' buttons to append listing IDs..."
                value={notes}
                onChange={(e) => handleNotesChange(e.target.value)}
                className="min-h-[400px] font-mono text-sm"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
