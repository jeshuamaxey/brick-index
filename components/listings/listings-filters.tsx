'use client';

import { useJobs } from '@/hooks/use-jobs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';
import type { ListingFilters } from '@/hooks/use-listings';

interface ListingsFiltersProps {
  filters: ListingFilters;
  onFiltersChange: (filters: ListingFilters) => void;
}

export function ListingsFilters({
  filters,
  onFiltersChange,
}: ListingsFiltersProps) {
  const { data: jobsData, isLoading: jobsLoading } = useJobs();

  const handleFilterChange = (key: keyof ListingFilters, value: string) => {
    onFiltersChange({
      ...filters,
      [key]: value === 'all' ? undefined : value || undefined,
    });
  };

  const clearFilters = () => {
    onFiltersChange({});
  };

  const activeFilterCount = Object.values(filters).filter(
    (v) => v !== undefined && v !== ''
  ).length;

  return (
    <div className="flex flex-wrap items-center gap-3 mb-4">
      <div className="flex items-center gap-2">
        <label className="text-xs text-foreground/70 whitespace-nowrap">
          Job:
        </label>
        <Select
          value={filters.job_id || 'all'}
          onValueChange={(value) => handleFilterChange('job_id', value)}
        >
          <SelectTrigger size="sm" className="w-[200px]">
            <SelectValue placeholder="All jobs" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All jobs</SelectItem>
            {jobsLoading ? (
              <SelectItem value="loading" disabled>
                Loading...
              </SelectItem>
            ) : (
              jobsData?.jobs
                .filter((job) => job.type.includes('refresh'))
                .map((job) => (
                  <SelectItem key={job.id} value={job.id}>
                    {job.type.replace(/_/g, ' ')} - {new Date(job.started_at).toLocaleDateString()}
                  </SelectItem>
                ))
            )}
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center gap-2">
        <label className="text-xs text-foreground/70 whitespace-nowrap">
          Status:
        </label>
        <Select
          value={filters.status || 'all'}
          onValueChange={(value) => handleFilterChange('status', value)}
        >
          <SelectTrigger size="sm" className="w-[120px]">
            <SelectValue placeholder="All" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="sold">Sold</SelectItem>
            <SelectItem value="expired">Expired</SelectItem>
            <SelectItem value="removed">Removed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center gap-2">
        <label className="text-xs text-foreground/70 whitespace-nowrap">
          Marketplace:
        </label>
        <Select
          value={filters.marketplace || 'all'}
          onValueChange={(value) => handleFilterChange('marketplace', value)}
        >
          <SelectTrigger size="sm" className="w-[120px]">
            <SelectValue placeholder="All" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="ebay">eBay</SelectItem>
            <SelectItem value="facebook">Facebook</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center gap-2">
        <label className="text-xs text-foreground/70 whitespace-nowrap">
          Enrichment:
        </label>
        <Select
          value={filters.enriched || 'all'}
          onValueChange={(value) => handleFilterChange('enriched', value as 'true' | 'false')}
        >
          <SelectTrigger size="sm" className="w-[140px]">
            <SelectValue placeholder="All" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="true">Enriched</SelectItem>
            <SelectItem value="false">Not Enriched</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {activeFilterCount > 0 && (
        <Button
          variant="ghost"
          size="sm"
          onClick={clearFilters}
          className="h-8 px-2 text-xs"
        >
          <X className="h-3 w-3 mr-1" />
          Clear ({activeFilterCount})
        </Button>
      )}
    </div>
  );
}
