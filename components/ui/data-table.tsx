'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

interface DataTableProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * Reusable data table wrapper component with sticky header and scrollable body
 * Provides the container structure for both TanStack Table and plain HTML tables
 */
export function DataTable({
  children,
  className,
}: DataTableProps) {
  return (
    <div
      className={cn(
        'rounded-md border border-foreground/10 h-full flex flex-col overflow-hidden bg-background',
        className
      )}
    >
      <div className="overflow-y-auto overflow-x-auto flex-1">
        <div className="relative w-full">
          {children}
        </div>
      </div>
    </div>
  );
}

interface DataTableHeaderProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * Sticky table header that stays visible while scrolling
 */
export function DataTableHeader({
  children,
  className,
}: DataTableHeaderProps) {
  return (
    <thead
      className={cn(
        'sticky top-0 z-20 bg-background border-b border-foreground/10 [&_tr]:border-b',
        className
      )}
    >
      {children}
    </thead>
  );
}

interface DataTableHeaderRowProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * Header row with consistent styling
 */
export function DataTableHeaderRow({
  children,
  className,
}: DataTableHeaderRowProps) {
  return (
    <tr className={cn('h-8 bg-background', className)}>
      {children}
    </tr>
  );
}

interface DataTableHeaderCellProps {
  children: React.ReactNode;
  className?: string;
  colSpan?: number;
}

/**
 * Header cell with consistent styling
 */
export function DataTableHeaderCell({
  children,
  className,
  colSpan,
}: DataTableHeaderCellProps) {
  return (
    <th
      colSpan={colSpan}
      className={cn(
        'h-8 px-2 py-1 text-left align-middle font-medium whitespace-nowrap text-foreground bg-background',
        className
      )}
    >
      {children}
    </th>
  );
}

interface DataTableBodyProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * Table body with consistent styling
 */
export function DataTableBody({
  children,
  className,
}: DataTableBodyProps) {
  return (
    <tbody className={cn('[&_tr:last-child]:border-0', className)}>
      {children}
    </tbody>
  );
}

interface DataTableRowProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
}

/**
 * Table row with hover effects and consistent styling
 */
export function DataTableRow({
  children,
  className,
  onClick,
}: DataTableRowProps) {
  return (
    <tr
      onClick={onClick}
      className={cn(
        'h-8 hover:bg-foreground/5 border-b transition-colors',
        onClick && 'cursor-pointer',
        className
      )}
    >
      {children}
    </tr>
  );
}

interface DataTableCellProps {
  children: React.ReactNode;
  className?: string;
  colSpan?: number;
}

/**
 * Table cell with consistent styling
 */
export function DataTableCell({
  children,
  className,
  colSpan,
}: DataTableCellProps) {
  return (
    <td
      colSpan={colSpan}
      className={cn('h-8 px-2 py-1 align-middle', className)}
    >
      {children}
    </td>
  );
}

interface DataTableEmptyProps {
  colSpan: number;
  message?: string;
  className?: string;
}

/**
 * Empty state row for tables
 */
export function DataTableEmpty({
  colSpan,
  message = 'No data found.',
  className,
}: DataTableEmptyProps) {
  return (
    <tr>
      <td
        colSpan={colSpan}
        className={cn(
          'h-16 text-center text-sm text-foreground/70',
          className
        )}
      >
        {message}
      </td>
    </tr>
  );
}
