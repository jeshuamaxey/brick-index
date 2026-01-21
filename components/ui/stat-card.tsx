'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { LucideIcon } from 'lucide-react';
import { cva, type VariantProps } from 'class-variance-authority';
import { PriceDisplay } from './price-display';

const statCardVariants = cva(
  'text-card-foreground rounded-lg border border-foreground/10 backdrop-blur-md bg-gradient-to-br from-card/80 via-card/60 to-card/40 shadow-sm p-6',
  {
    variants: {
      variant: {
        default: '',
        compact: 'p-4',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

export interface StatCardProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof statCardVariants> {
  label: string;
  value: number | string;
  icon?: LucideIcon;
  showTrend?: boolean;
  trendValue?: number;
  trendPercentage?: number;
  valueFormatter?: (value: number | string) => string;
  currency?: string;
  isPrice?: boolean;
  timePeriod?: string;
}

export function StatCard({
  label,
  value,
  icon: Icon,
  variant,
  showTrend = false,
  trendValue,
  trendPercentage,
  valueFormatter,
  currency = '$',
  isPrice = false,
  timePeriod,
  className,
  ...props
}: StatCardProps) {
  const isNumeric = typeof value === 'number';
  const shouldUsePriceDisplay = isPrice && isNumeric;

  return (
    <div className={cn(statCardVariants({ variant }), className)} {...props}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-muted-foreground mb-2">{label}</p>
          {shouldUsePriceDisplay ? (
            <PriceDisplay
              value={value}
              currency={currency}
              variant="large"
              showChange={showTrend}
              changePercentage={trendPercentage}
              changeValue={trendValue}
              timePeriod={timePeriod}
            />
          ) : (
            <>
              <p
                className={cn(
                  'text-2xl font-semibold text-foreground',
                  isNumeric && 'font-mono tabular-nums'
                )}
              >
                {valueFormatter
                  ? valueFormatter(value)
                  : isNumeric
                    ? value.toLocaleString()
                    : value}
              </p>
            </>
          )}
        </div>
        {Icon && (
          <div className="ml-4 p-2 rounded-lg backdrop-blur-sm bg-brand/5 border border-brand/20">
            <Icon className="h-5 w-5 text-brand" />
          </div>
        )}
      </div>
    </div>
  );
}
