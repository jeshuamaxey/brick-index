import { useQuery } from '@tanstack/react-query';
import { useState, useEffect } from 'react';
import type { LegoSetSearchResult } from '@/app/api/catalog/search/route';

interface CatalogSearchResponse {
  results: LegoSetSearchResult[];
  message?: string;
  error?: string;
}

async function searchCatalog(query: string): Promise<LegoSetSearchResult[]> {
  if (!query || query.length < 2) {
    return [];
  }

  const response = await fetch(`/api/catalog/search?q=${encodeURIComponent(query)}`);

  if (!response.ok) {
    const data = await response.json();
    throw new Error(data.error || 'Failed to search catalog');
  }

  const data: CatalogSearchResponse = await response.json();
  return data.results || [];
}

export function useCatalogSearch(searchTerm: string, debounceMs: number = 300) {
  const [debouncedTerm, setDebouncedTerm] = useState(searchTerm);

  // Debounce the search term
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedTerm(searchTerm);
    }, debounceMs);

    return () => clearTimeout(timer);
  }, [searchTerm, debounceMs]);

  return useQuery({
    queryKey: ['catalog-search', debouncedTerm],
    queryFn: () => searchCatalog(debouncedTerm),
    enabled: debouncedTerm.length >= 2,
    staleTime: 60 * 1000, // Cache results for 1 minute
  });
}

// Re-export the type for convenience
export type { LegoSetSearchResult };
