'use client';

import Image from 'next/image';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ExternalLink, Package, ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SetHeaderProps {
  setNum: string;
  name: string;
  year: number | null;
  themeName?: string | null;
  numParts: number | null;
  setImgUrl: string | null;
  setUrl: string | null;
  className?: string;
}

/**
 * Header component for the set detail page
 * Shows set image and key metadata
 */
export function SetHeader({
  setNum,
  name,
  year,
  themeName,
  numParts,
  setImgUrl,
  setUrl,
  className,
}: SetHeaderProps) {
  return (
    <div className={cn('space-y-6', className)}>
      {/* Back Link */}
      <Link
        href="/"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to all sets
      </Link>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
        {/* Image */}
        <div className="relative aspect-square rounded-lg border border-foreground/10 backdrop-blur-md bg-gradient-to-br from-card/80 via-card/60 to-card/40 shadow-sm overflow-hidden">
          {setImgUrl ? (
            <Image
              src={setImgUrl}
              alt={name}
              fill
              className="object-contain p-8"
              sizes="(max-width: 768px) 100vw, 50vw"
              priority
            />
          ) : (
            <div className="flex items-center justify-center h-full">
              <Package className="h-24 w-24 text-muted-foreground/30" />
            </div>
          )}
        </div>

        {/* Info */}
        <div className="space-y-6">
          {/* Set Number Badge */}
          <div className="inline-flex items-center px-3 py-1 rounded-md backdrop-blur-sm bg-brand/10 border border-brand/20">
            <span className="text-sm font-mono tabular-nums text-brand font-medium">
              {setNum}
            </span>
          </div>

          {/* Name */}
          <h1 className="text-3xl md:text-4xl font-bold text-foreground leading-tight">
            {name}
          </h1>

          {/* Metadata */}
          <div className="flex flex-wrap items-center gap-4 text-muted-foreground">
            {year && (
              <div className="flex items-center gap-2">
                <span className="text-sm">Released</span>
                <span className="font-mono tabular-nums font-medium text-foreground">
                  {year}
                </span>
              </div>
            )}
            {numParts && (
              <div className="flex items-center gap-2">
                <span className="text-sm">Pieces</span>
                <span className="font-mono tabular-nums font-medium text-foreground">
                  {numParts.toLocaleString()}
                </span>
              </div>
            )}
            {themeName && (
              <div className="flex items-center gap-2">
                <span className="text-sm">Theme</span>
                <span className="font-medium text-foreground">{themeName}</span>
              </div>
            )}
          </div>

          {/* External Link */}
          {setUrl && (
            <div className="pt-4">
              <a href={setUrl} target="_blank" rel="noopener noreferrer">
                <Button variant="outline" className="border-foreground/20">
                  <ExternalLink className="h-4 w-4 mr-2" />
                  View on Rebrickable
                </Button>
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
