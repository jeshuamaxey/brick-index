'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { Button } from './button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './select';
import { Checkbox } from './checkbox';
import { Label } from './label';
import { X, SlidersHorizontal } from 'lucide-react';
import { Separator } from './separator';

export interface FilterOption {
  value: string;
  label: string;
}

export interface FilterPanelProps extends React.HTMLAttributes<HTMLDivElement> {
  priceRange?: { min: number; max: number };
  onPriceRangeChange?: (range: { min: number; max: number }) => void;
  statusOptions?: FilterOption[];
  selectedStatuses?: string[];
  onStatusChange?: (statuses: string[]) => void;
  marketplaceOptions?: FilterOption[];
  selectedMarketplaces?: string[];
  onMarketplaceChange?: (marketplaces: string[]) => void;
  conditionOptions?: FilterOption[];
  selectedConditions?: string[];
  onConditionChange?: (conditions: string[]) => void;
  onClearFilters?: () => void;
  activeFilterCount?: number;
  variant?: 'sidebar' | 'inline' | 'drawer';
}

export function FilterPanel({
  priceRange,
  onPriceRangeChange,
  statusOptions = [
    { value: 'active', label: 'Active' },
    { value: 'sold', label: 'Sold' },
    { value: 'expired', label: 'Expired' },
    { value: 'removed', label: 'Removed' },
  ],
  selectedStatuses = [],
  onStatusChange,
  marketplaceOptions = [
    { value: 'ebay', label: 'eBay' },
    { value: 'facebook', label: 'Facebook' },
  ],
  selectedMarketplaces = [],
  onMarketplaceChange,
  conditionOptions = [
    { value: 'new', label: 'New' },
    { value: 'used', label: 'Used' },
    { value: 'parts', label: 'Parts Only' },
  ],
  selectedConditions = [],
  onConditionChange,
  onClearFilters,
  activeFilterCount = 0,
  variant = 'sidebar',
  className,
  ...props
}: FilterPanelProps) {
  const handleStatusToggle = (value: string) => {
    if (!onStatusChange) return;
    const newStatuses = selectedStatuses.includes(value)
      ? selectedStatuses.filter((s) => s !== value)
      : [...selectedStatuses, value];
    onStatusChange(newStatuses);
  };

  const handleMarketplaceToggle = (value: string) => {
    if (!onMarketplaceChange) return;
    const newMarketplaces = selectedMarketplaces.includes(value)
      ? selectedMarketplaces.filter((m) => m !== value)
      : [...selectedMarketplaces, value];
    onMarketplaceChange(newMarketplaces);
  };

  const handleConditionToggle = (value: string) => {
    if (!onConditionChange) return;
    const newConditions = selectedConditions.includes(value)
      ? selectedConditions.filter((c) => c !== value)
      : [...selectedConditions, value];
    onConditionChange(newConditions);
  };

  const containerClass = cn(
    'rounded-lg border border-foreground/10 backdrop-blur-md bg-gradient-to-br from-card/80 via-card/60 to-card/40 shadow-lg',
    variant === 'sidebar' && 'p-6',
    variant === 'inline' && 'p-4',
    variant === 'drawer' && 'p-6',
    className
  );

  return (
    <div className={containerClass} {...props}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
          <h3 className="font-semibold text-sm text-foreground">Filters</h3>
          {activeFilterCount > 0 && (
            <span className="px-2 py-0.5 rounded-full bg-brand/10 text-brand text-xs font-medium font-mono tabular-nums">
              {activeFilterCount}
            </span>
          )}
        </div>
        {activeFilterCount > 0 && onClearFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onClearFilters}
            className="h-8 px-2 text-xs text-foreground"
          >
            <X className="h-3 w-3 mr-1" />
            Clear
          </Button>
        )}
      </div>

      <div className="space-y-4">
        {/* Price Range */}
        {priceRange && onPriceRangeChange && (
          <>
            <div>
              <Label className="text-sm font-medium text-foreground mb-2 block">Price Range</Label>
              <div className="flex items-center gap-2">
                <div className="flex-1">
                  <Label className="text-xs text-muted-foreground mb-1 block">Min</Label>
                  <input
                    type="number"
                    value={priceRange.min}
                    onChange={(e) =>
                      onPriceRangeChange({
                        ...priceRange,
                        min: Number(e.target.value),
                      })
                    }
                    className="w-full px-3 py-2 text-sm border rounded-md bg-background text-foreground font-mono tabular-nums"
                    placeholder="0"
                  />
                </div>
                <div className="flex-1">
                  <Label className="text-xs text-muted-foreground mb-1 block">Max</Label>
                  <input
                    type="number"
                    value={priceRange.max}
                    onChange={(e) =>
                      onPriceRangeChange({
                        ...priceRange,
                        max: Number(e.target.value),
                      })
                    }
                    className="w-full px-3 py-2 text-sm border rounded-md bg-background text-foreground font-mono tabular-nums"
                    placeholder="1000"
                  />
                </div>
              </div>
            </div>
            <Separator />
          </>
        )}

        {/* Status Filters */}
        {onStatusChange && (
          <>
            <div>
              <Label className="text-sm font-medium text-foreground mb-2 block">Status</Label>
              <div className="space-y-2">
                {statusOptions.map((option) => (
                  <div key={option.value} className="flex items-center space-x-2">
                    <Checkbox
                      id={`status-${option.value}`}
                      checked={selectedStatuses.includes(option.value)}
                      onCheckedChange={() => handleStatusToggle(option.value)}
                    />
                    <Label
                      htmlFor={`status-${option.value}`}
                      className="text-sm font-normal text-foreground cursor-pointer"
                    >
                      {option.label}
                    </Label>
                  </div>
                ))}
              </div>
            </div>
            <Separator />
          </>
        )}

        {/* Marketplace Filters */}
        {onMarketplaceChange && (
          <>
            <div>
              <Label className="text-sm font-medium text-foreground mb-2 block">Marketplace</Label>
              <div className="space-y-2">
                {marketplaceOptions.map((option) => (
                  <div key={option.value} className="flex items-center space-x-2">
                    <Checkbox
                      id={`marketplace-${option.value}`}
                      checked={selectedMarketplaces.includes(option.value)}
                      onCheckedChange={() => handleMarketplaceToggle(option.value)}
                    />
                    <Label
                      htmlFor={`marketplace-${option.value}`}
                      className="text-sm font-normal text-foreground cursor-pointer"
                    >
                      {option.label}
                    </Label>
                  </div>
                ))}
              </div>
            </div>
            <Separator />
          </>
        )}

        {/* Condition Filters */}
        {onConditionChange && (
            <div>
            <Label className="text-sm font-medium text-foreground mb-2 block">Condition</Label>
            <div className="space-y-2">
              {conditionOptions.map((option) => (
                <div key={option.value} className="flex items-center space-x-2">
                  <Checkbox
                    id={`condition-${option.value}`}
                    checked={selectedConditions.includes(option.value)}
                    onCheckedChange={() => handleConditionToggle(option.value)}
                  />
                  <Label
                    htmlFor={`condition-${option.value}`}
                    className="text-sm font-normal text-foreground cursor-pointer"
                  >
                    {option.label}
                  </Label>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
