'use client';

import { useState, useRef, useEffect } from 'react';
import { Search, X, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useCatalogSearch, type LegoSetSearchResult } from '@/hooks/use-catalog-search';
import { cn } from '@/lib/utils';

export interface LegoSetSearchProps {
  onSelect: (set: LegoSetSearchResult) => void;
  selectedSet?: LegoSetSearchResult | null;
  onClear?: () => void;
  placeholder?: string;
  className?: string;
}

export function LegoSetSearch({
  onSelect,
  selectedSet,
  onClear,
  placeholder = 'Search for a LEGO set...',
  className,
}: LegoSetSearchProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { data: results = [], isLoading, isFetching } = useCatalogSearch(searchTerm);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Show dropdown when there are results
  useEffect(() => {
    if (results.length > 0 && searchTerm.length >= 2) {
      setIsOpen(true);
    }
  }, [results, searchTerm]);

  const handleSelect = (set: LegoSetSearchResult) => {
    onSelect(set);
    setSearchTerm('');
    setIsOpen(false);
  };

  const handleClear = () => {
    setSearchTerm('');
    setIsOpen(false);
    onClear?.();
    inputRef.current?.focus();
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
    if (e.target.value.length >= 2) {
      setIsOpen(true);
    } else {
      setIsOpen(false);
    }
  };

  const handleInputFocus = () => {
    if (results.length > 0 && searchTerm.length >= 2) {
      setIsOpen(true);
    }
  };

  // If a set is selected, show the selected set display
  if (selectedSet) {
    return (
      <div className={cn('relative', className)} ref={containerRef}>
        <div className="flex items-center gap-3 p-3 rounded-md border bg-muted/50">
          {selectedSet.set_img_url && (
            <img
              src={selectedSet.set_img_url}
              alt={selectedSet.name}
              className="w-12 h-12 object-contain rounded"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
          )}
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm truncate">{selectedSet.name}</p>
            <p className="text-xs text-muted-foreground">
              {selectedSet.set_num}
              {selectedSet.year && ` • ${selectedSet.year}`}
              {selectedSet.num_parts && ` • ${selectedSet.num_parts} pieces`}
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleClear}
            className="h-8 w-8 p-0 shrink-0"
          >
            <X className="h-4 w-4" />
            <span className="sr-only">Clear selection</span>
          </Button>
        </div>
      </div>
    );
  }

  // Show search input
  return (
    <div className={cn('relative', className)} ref={containerRef}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          ref={inputRef}
          type="text"
          value={searchTerm}
          onChange={handleInputChange}
          onFocus={handleInputFocus}
          placeholder={placeholder}
          className="pl-10 pr-10"
        />
        {(isLoading || isFetching) && searchTerm.length >= 2 && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground animate-spin" />
        )}
      </div>

      {/* Dropdown results */}
      {isOpen && results.length > 0 && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 rounded-md border bg-popover shadow-lg max-h-[300px] overflow-y-auto">
          {results.map((set) => (
            <button
              key={set.set_num}
              type="button"
              onClick={() => handleSelect(set)}
              className="w-full flex items-center gap-3 p-3 hover:bg-accent text-left transition-colors border-b last:border-b-0"
            >
              {set.set_img_url && (
                <img
                  src={set.set_img_url}
                  alt={set.name}
                  className="w-10 h-10 object-contain rounded shrink-0"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
              )}
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">{set.name}</p>
                <p className="text-xs text-muted-foreground">
                  {set.set_num}
                  {set.year && ` • ${set.year}`}
                  {set.num_parts && ` • ${set.num_parts} pieces`}
                </p>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* No results message */}
      {isOpen && searchTerm.length >= 2 && !isLoading && !isFetching && results.length === 0 && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 rounded-md border bg-popover shadow-lg p-4 text-center text-sm text-muted-foreground">
          No LEGO sets found matching &quot;{searchTerm}&quot;
        </div>
      )}
    </div>
  );
}
