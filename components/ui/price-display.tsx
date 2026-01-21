'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { ArrowUp, ArrowDown, Minus } from 'lucide-react';
import { cva, type VariantProps } from 'class-variance-authority';

const priceDisplayVariants = cva(
  'font-mono font-semibold tabular-nums text-foreground',
  {
    variants: {
      variant: {
        default: 'text-lg',
        large: 'text-2xl',
        compact: 'text-sm',
      },
      showChange: {
        true: '',
        false: '',
      },
    },
    defaultVariants: {
      variant: 'default',
      showChange: false,
    },
  }
);

export type TimePeriod = '1d' | '7d' | '30d' | '90d' | '1y' | 'all' | string;

export interface PriceDisplayProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof priceDisplayVariants> {
  value: number;
  currency?: string;
  showChange?: boolean;
  changeValue?: number;
  changePercentage?: number;
  timePeriod?: TimePeriod;
}

const timePeriodLabels: Record<string, string> = {
  '1d': '1 day',
  '7d': '7 days',
  '30d': '30 days',
  '90d': '90 days',
  '1y': '1 year',
  'all': 'all time',
};

export function PriceDisplay({
  value,
  currency = '$',
  variant,
  showChange = false,
  changeValue,
  changePercentage,
  timePeriod,
  className,
  ...props
}: PriceDisplayProps) {
  const formattedValue = value.toFixed(2);
  const hasChange = showChange && (changeValue !== undefined || changePercentage !== undefined);
  const change = changeValue ?? (changePercentage !== undefined ? (value * changePercentage) / 100 : 0);
  const isPositive = change > 0;
  const isNegative = change < 0;
  const isNeutral = change === 0;

  const timePeriodLabel = timePeriod
    ? timePeriodLabels[timePeriod] || timePeriod
    : null;

  return (
    <div className={cn('flex items-center gap-2', className)} {...props}>
      <span className={cn(priceDisplayVariants({ variant }))}>
        {currency}
        {formattedValue}
      </span>
      {hasChange && (
        <div className="flex items-center gap-1.5">
          <div
            className={cn(
              'flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-md backdrop-blur-sm bg-background/40',
              isPositive && 'text-green-600 dark:text-green-400',
              isNegative && 'text-red-600 dark:text-red-400',
              isNeutral && 'text-muted-foreground'
            )}
          >
            {isPositive && <ArrowUp className="h-3 w-3" />}
            {isNegative && <ArrowDown className="h-3 w-3" />}
            {isNeutral && <Minus className="h-3 w-3" />}
            <span className="font-mono tabular-nums">
              {changePercentage !== undefined
                ? `${Math.abs(changePercentage).toFixed(1)}%`
                : `${Math.abs(change).toFixed(2)}`}
            </span>
          </div>
          {timePeriodLabel && (
            <span className="text-xs text-muted-foreground">
              ({timePeriodLabel})
            </span>
          )}
        </div>
      )}
    </div>
  );
}
