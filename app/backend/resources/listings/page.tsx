// Backend page to view captured listings

'use client';

import { useState } from 'react';
import { useListings, type ListingFilters, type PaginationParams } from '@/hooks/use-listings';
import { DataTable, type ListingRow } from '@/components/listings/data-table';
import { ListingsFilters } from '@/components/listings/listings-filters';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { ListingDetailPanel } from '@/components/listings/listing-detail-panel';

const PAGE_SIZE = 50;

export default function ListingsPage() {
  const [filters, setFilters] = useState<ListingFilters>({});
  const [page, setPage] = useState(0);
  const [selectedListingId, setSelectedListingId] = useState<string | null>(null);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  
  const pagination: PaginationParams = {
    limit: PAGE_SIZE,
    offset: page * PAGE_SIZE,
  };

  const { data, isLoading, error } = useListings(filters, pagination);

  const handleFiltersChange = (newFilters: ListingFilters) => {
    setFilters(newFilters);
    setPage(0); // Reset to first page when filters change
  };

  const listings: ListingRow[] = data?.listings || [];
  const total = data?.total || 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  const handlePageChange = (newPage: number) => {
    setPage(Math.max(0, Math.min(newPage, totalPages - 1)));
  };

  const handleRowClick = (listing: ListingRow) => {
    setSelectedListingId(listing.id);
    setIsPanelOpen(true);
  };

  if (error) {
    return (
      <div className="flex flex-col h-full bg-background text-foreground p-4">
        <div className="flex items-center justify-between mb-4 shrink-0">
          <h1 className="text-2xl font-bold">Captured Listings</h1>
        </div>
        <div className="bg-destructive/10 border border-destructive/20 text-destructive px-4 py-3 rounded">
          Error: {error instanceof Error ? error.message : 'Unknown error occurred'}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-background text-foreground p-4">
      {/* Header section - fixed */}
      <div className="flex items-center justify-between mb-4 shrink-0">
        <h1 className="text-2xl font-bold">Captured Listings</h1>
      </div>

      {/* Total count display - fixed */}
      <div className="mb-4 shrink-0">
        <p className="text-sm text-foreground/70">
          Total: <span className="font-semibold text-foreground">{total.toLocaleString()}</span> listings
          {listings.length > 0 && (
            <span className="ml-2">
              (showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)})
            </span>
          )}
        </p>
      </div>

      {/* Filters - fixed */}
      <div className="shrink-0 mb-4">
        <ListingsFilters filters={filters} onFiltersChange={handleFiltersChange} />
      </div>

      {/* Scrollable table container */}
      <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
        {/* Loading state */}
        {isLoading && !data && (
          <div className="space-y-2">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </div>
        )}

        {/* Data table - scrollable */}
        {!isLoading && data && (
          <>
            <div className="flex-1 min-h-0">
              <DataTable data={listings} onRowClick={handleRowClick} />
            </div>

            {/* Pagination - fixed at bottom */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-4 shrink-0 pt-4 border-t border-foreground/10">
                <div className="text-sm text-foreground/70">
                  Page {page + 1} of {totalPages}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(page - 1)}
                    disabled={page === 0}
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(page + 1)}
                    disabled={page >= totalPages - 1}
                  >
                    Next
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}

        {/* Empty state */}
        {!isLoading && data && listings.length === 0 && (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center text-foreground/70">
              <p className="text-lg font-medium mb-2">No listings found</p>
              <p className="text-sm">
                {Object.keys(filters).length > 0
                  ? 'Try adjusting your filters'
                  : 'No listings have been captured yet'}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Listing Detail Panel */}
      <Sheet
        open={isPanelOpen}
        onOpenChange={(open) => {
          setIsPanelOpen(open);
          if (!open) {
            // Clear selected listing after animation completes
            setTimeout(() => setSelectedListingId(null), 300);
          }
        }}
      >
        <SheetContent
          side="right"
          className="w-[80%] sm:w-1/2 sm:max-w-none overflow-y-auto"
        >
          {selectedListingId && (
            <>
              <SheetHeader>
                <SheetTitle>Listing Details</SheetTitle>
              </SheetHeader>
              <div className="mt-6">
                <ListingDetailPanel listingId={selectedListingId} />
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
