'use client';

import * as React from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  type ColumnDef,
  type SortingState,
  flexRender,
} from '@tanstack/react-table';
import { useState } from 'react';
import {
  DataTable,
  DataTableHeader,
  DataTableBody,
  DataTableEmpty,
  DataTableRow,
  DataTableCell,
} from './data-table';

interface DataTableTanStackProps<TData> {
  data: TData[];
  columns: ColumnDef<TData>[];
  defaultSorting?: SortingState;
  emptyMessage?: string;
  className?: string;
}

/**
 * Reusable data table component built on TanStack Table
 * Provides sorting, sticky header, and consistent styling
 */
export function DataTableTanStack<TData>({
  data,
  columns,
  defaultSorting = [],
  emptyMessage = 'No data found.',
  className,
}: DataTableTanStackProps<TData>) {
  const [sorting, setSorting] = useState<SortingState>(defaultSorting);

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    onSortingChange: setSorting,
    state: {
      sorting,
    },
  });

  return (
    <DataTable className={className}>
      <table className="w-full caption-bottom text-sm">
        <DataTableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id} className="h-8 bg-background">
              {headerGroup.headers.map((header) => (
                <th
                  key={header.id}
                  className="h-8 px-2 py-1 text-left align-middle font-medium whitespace-nowrap text-foreground bg-background"
                >
                  {header.isPlaceholder
                    ? null
                    : flexRender(
                        header.column.columnDef.header,
                        header.getContext()
                      )}
                </th>
              ))}
            </tr>
          ))}
        </DataTableHeader>
        <DataTableBody>
          {table.getRowModel().rows?.length ? (
            table.getRowModel().rows.map((row) => (
              <DataTableRow key={row.id} data-state={row.getIsSelected() && 'selected'}>
                {row.getVisibleCells().map((cell) => (
                  <DataTableCell key={cell.id}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </DataTableCell>
                ))}
              </DataTableRow>
            ))
          ) : (
            <DataTableEmpty colSpan={columns.length} message={emptyMessage} />
          )}
        </DataTableBody>
      </table>
    </DataTable>
  );
}
