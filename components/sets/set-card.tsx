'use client';

import Link from 'next/link';
import Image from 'next/image';
import { PriceDisplay } from '@/components/ui/price-display';
import { cn } from '@/lib/utils';
import type { PriceAggregate } from '@/lib/types';
import { Lock, Package } from 'lucide-react';

interface SetCardProps {
  setNum: string;
  name: string;
  year: number | null;
  numParts: number | null;
  setImgUrl: string | null;
  pricing: PriceAggregate | null;
  isAuthenticated: boolean;
  className?: string;
}

/**
 * Card component for displaying a LEGO set in a grid
 * Shows set image, metadata, and pricing (auth-gated)
 */
export function SetCard({
  setNum,
  name,
  year,
  numParts,
  setImgUrl,
  pricing,
  isAuthenticated,
  className,
}: SetCardProps) {
  const hasPricing = pricing && pricing.listingCount > 0;

  return (
    <Link href={`/sets/${setNum}`}>
      <div
        className={cn(
          'group relative rounded-lg border border-foreground/10',
          'backdrop-blur-md bg-gradient-to-br from-card/80 via-card/60 to-card/40',
          'shadow-sm hover:shadow-md transition-all duration-200',
          'overflow-hidden',
          className
        )}
      >
        {/* Image */}
        <div className="aspect-square relative bg-muted/20 overflow-hidden">
          {setImgUrl ? (
            <Image
              src={setImgUrl}
              alt={name}
              fill
              className="object-contain p-4 group-hover:scale-105 transition-transform duration-300"
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
            />
          ) : (
            <div className="flex items-center justify-center h-full">
              <Package className="h-16 w-16 text-muted-foreground/30" />
            </div>
          )}
        </div>

        {/* Content */}
        <div className="p-4 space-y-3">
          {/* Set Info */}
          <div>
            <p className="text-xs text-muted-foreground font-mono tabular-nums mb-1">
              {setNum}
            </p>
            <h3 className="font-semibold text-foreground line-clamp-2 leading-tight">
              {name}
            </h3>
          </div>

          {/* Metadata */}
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            {year && (
              <span className="font-mono tabular-nums">{year}</span>
            )}
            {numParts && (
              <>
                <span className="text-foreground/20">•</span>
                <span className="font-mono tabular-nums">{numParts.toLocaleString()} pcs</span>
              </>
            )}
          </div>

          {/* Pricing Section */}
          <div className="pt-2 border-t border-foreground/10">
            {isAuthenticated ? (
              hasPricing ? (
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Avg Price</p>
                    <PriceDisplay value={pricing.avgPrice} variant="default" />
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground mb-1">Listings</p>
                    <p className="font-mono tabular-nums text-sm font-medium text-foreground">
                      {pricing.listingCount}
                    </p>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No pricing data yet</p>
              )
            ) : (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Lock className="h-4 w-4" />
                <span>Sign in to view pricing</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}
