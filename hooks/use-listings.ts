import { useQuery } from '@tanstack/react-query';

export interface ListingFilters {
  status?: string;
  job_id?: string;
  marketplace?: string;
  enriched?: 'true' | 'false';
}

export interface PaginationParams {
  limit: number;
  offset: number;
}

export interface ListingsResponse {
  listings: Array<{
    id: string;
    title: string;
    price: number | null;
    currency: string | null;
    url: string;
    marketplace: string;
    status: string;
    created_at: string;
    enriched_at: string | null;
    condition_description: string | null;
    job_id: string | null;
    listing_analysis?: Array<{
      piece_count: number | null;
      minifig_count: number | null;
      price_per_piece: number | null;
    }>;
  }>;
  total: number;
  limit: number;
  offset: number;
}

async function fetchListings(
  filters: ListingFilters,
  pagination: PaginationParams
): Promise<ListingsResponse> {
  const params = new URLSearchParams();
  
  if (filters.status) {
    params.append('status', filters.status);
  }
  if (filters.job_id) {
    params.append('job_id', filters.job_id);
  }
  if (filters.marketplace) {
    params.append('marketplace', filters.marketplace);
  }
  if (filters.enriched) {
    params.append('enriched', filters.enriched);
  }
  
  params.append('limit', pagination.limit.toString());
  params.append('offset', pagination.offset.toString());

  const response = await fetch(`/api/listings/search?${params.toString()}`);
  
  if (!response.ok) {
    throw new Error('Failed to fetch listings');
  }

  return response.json();
}

export function useListings(
  filters: ListingFilters,
  pagination: PaginationParams
) {
  return useQuery({
    queryKey: ['listings', filters, pagination],
    queryFn: () => fetchListings(filters, pagination),
    placeholderData: (previousData) => previousData, // Keep previous data while loading
  });
}
