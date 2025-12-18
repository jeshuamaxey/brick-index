'use client';

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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { ArrowUpDown } from 'lucide-react';

export type ListingRow = {
  id: string;
  title: string;
  price: number | null;
  currency: string | null;
  url: string;
  marketplace: string;
  status: string;
  created_at: string;
  condition_description: string | null;
  listing_analysis?: Array<{
    piece_count: number | null;
    minifig_count: number | null;
    price_per_piece: number | null;
  }>;
};

function truncate(str: string, length: number): string {
  if (str.length <= length) return str;
  return str.substring(0, length) + '...';
}

function formatPrice(price: number | null, currency: string | null): string {
  if (price === null) return 'N/A';
  return `${currency || '$'}${price.toFixed(2)}`;
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getStatusBadgeClass(status: string): string {
  switch (status) {
    case 'active':
      return 'bg-green-500/20 text-green-700 dark:text-green-400 border border-green-500/30';
    case 'sold':
      return 'bg-blue-500/20 text-blue-700 dark:text-blue-400 border border-blue-500/30';
    case 'expired':
      return 'bg-gray-500/20 text-gray-700 dark:text-gray-400 border border-gray-500/30';
    case 'removed':
      return 'bg-red-500/20 text-red-700 dark:text-red-400 border border-red-500/30';
    default:
      return 'bg-foreground/10 text-foreground border border-foreground/20';
  }
}

const columns: ColumnDef<ListingRow>[] = [
  {
    accessorKey: 'title',
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          size="sm"
          className="h-6 px-2 text-xs font-medium"
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
        >
          Title
          <ArrowUpDown className="ml-1 h-3 w-3" />
        </Button>
      );
    },
    cell: ({ row }) => {
      const title = row.getValue('title') as string;
      return (
        <span
          className="text-xs text-foreground max-w-[300px] block truncate"
          title={title}
        >
          {truncate(title, 50)}
        </span>
      );
    },
  },
  {
    accessorKey: 'price',
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          size="sm"
          className="h-6 px-2 text-xs font-medium"
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
        >
          Price
          <ArrowUpDown className="ml-1 h-3 w-3" />
        </Button>
      );
    },
    cell: ({ row }) => {
      const price = row.getValue('price') as number | null;
      const currency = row.original.currency;
      return (
        <span className="text-xs text-foreground/90">
          {formatPrice(price, currency)}
        </span>
      );
    },
  },
  {
    accessorKey: 'marketplace',
    header: 'Marketplace',
    cell: ({ row }) => {
      return (
        <span className="text-xs text-foreground/70">
          {row.getValue('marketplace') as string}
        </span>
      );
    },
  },
  {
    accessorKey: 'status',
    header: 'Status',
    cell: ({ row }) => {
      const status = row.getValue('status') as string;
      return (
        <span
          className={`px-1.5 py-0.5 rounded text-xs font-medium ${getStatusBadgeClass(
            status
          )}`}
        >
          {status}
        </span>
      );
    },
  },
  {
    accessorKey: 'condition_description',
    header: 'Condition',
    cell: ({ row }) => {
      const condition = row.original.condition_description;
      if (!condition) return <span className="text-xs text-foreground/40">—</span>;
      return (
        <span className="text-xs text-foreground/70 max-w-[200px] block truncate" title={condition}>
          {truncate(condition, 30)}
        </span>
      );
    },
  },
  {
    id: 'pieces',
    header: 'Pieces',
    cell: ({ row }) => {
      const analysis = row.original.listing_analysis?.[0];
      const pieces = analysis?.piece_count;
      return (
        <span className="text-xs text-foreground/70">
          {pieces ?? '—'}
        </span>
      );
    },
  },
  {
    id: 'minifigs',
    header: 'Minifigs',
    cell: ({ row }) => {
      const analysis = row.original.listing_analysis?.[0];
      const minifigs = analysis?.minifig_count;
      return (
        <span className="text-xs text-foreground/70">
          {minifigs ?? '—'}
        </span>
      );
    },
  },
  {
    id: 'price_per_piece',
    header: 'Price/Piece',
    cell: ({ row }) => {
      const analysis = row.original.listing_analysis?.[0];
      const ppp = analysis?.price_per_piece;
      return (
        <span className="text-xs text-foreground/70">
          {ppp ? `$${ppp.toFixed(4)}` : '—'}
        </span>
      );
    },
  },
  {
    accessorKey: 'created_at',
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          size="sm"
          className="h-6 px-2 text-xs font-medium"
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
        >
          Created
          <ArrowUpDown className="ml-1 h-3 w-3" />
        </Button>
      );
    },
    cell: ({ row }) => {
      return (
        <span className="text-xs text-foreground/70">
          {formatDate(row.getValue('created_at') as string)}
        </span>
      );
    },
  },
];

interface DataTableProps {
  data: ListingRow[];
  onRowClick?: (listing: ListingRow) => void;
}

export function DataTable({ data, onRowClick }: DataTableProps) {
  const [sorting, setSorting] = useState<SortingState>([
    { id: 'created_at', desc: true },
  ]);

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
    <div className="rounded-md border border-foreground/10 h-full flex flex-col overflow-hidden">
      <div className="overflow-auto flex-1">
        <div className="relative">
          <table className="w-full caption-bottom text-sm">
            <thead
              className="sticky top-0 z-20 bg-background border-b border-foreground/10 [&_tr]:border-b"
            >
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
            </thead>
            <tbody className="[&_tr:last-child]:border-0">
              {table.getRowModel().rows?.length ? (
                table.getRowModel().rows.map((row) => (
                  <tr
                    key={row.id}
                    data-state={row.getIsSelected() && 'selected'}
                    className={`h-8 hover:bg-foreground/5 border-b transition-colors ${
                      onRowClick ? 'cursor-pointer' : ''
                    }`}
                    onClick={() => onRowClick?.(row.original)}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <td
                        key={cell.id}
                        className="h-8 px-2 py-1 align-middle whitespace-nowrap"
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan={columns.length}
                    className="h-16 text-center text-sm text-foreground/70"
                  >
                    No listings found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
