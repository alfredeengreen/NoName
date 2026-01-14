'use client';

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
import { Card, CardContent, CardHeader } from '@/components/ui/card';

export interface Column<T> {
  // Legacy API
  key?: keyof T | string;
  label?: string;
  render?: (value: any, row: T) => React.ReactNode;
  sortable?: boolean;
  // New API (for compatibility)
  header?: string;
  accessorKey?: keyof T | string;
  cell?: (row: T) => React.ReactNode;
}

interface DataTableProps<T> {
  data: T[];
  columns: Column<T>[];
  keyExtractor?: (row: T) => string | number;
  onRowClick?: (row: T) => void;
  pagination?: {
    pageSize: number;
  };
  exportable?: boolean;
  onExport?: () => void;
}

export default function DataTable<T extends Record<string, any>>({
  data,
  columns,
  keyExtractor,
  onRowClick,
  pagination,
  exportable = false,
  onExport,
}: DataTableProps<T>) {
  const [sortColumn, setSortColumn] = useState<keyof T | string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [currentPage, setCurrentPage] = useState(1);

  // Ensure data is always an array
  const safeData = Array.isArray(data) ? data : [];

  const pageSize = pagination?.pageSize || 50;
  const totalPages = Math.ceil(safeData.length / pageSize);

  const handleSort = (column: Column<T>) => {
    const columnKey = column.key || column.accessorKey;
    if (!column.sortable && !columnKey) return;

    if (sortColumn === columnKey) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(columnKey || null);
      setSortDirection('asc');
    }
  };

  const sortedData = [...safeData].sort((a, b) => {
    if (!sortColumn) return 0;

    const aValue = a[sortColumn as keyof T];
    const bValue = b[sortColumn as keyof T];

    // Handle null/undefined values
    if (aValue == null && bValue == null) return 0;
    if (aValue == null) return 1;
    if (bValue == null) return -1;

    if (aValue === bValue) return 0;

    const comparison = aValue < bValue ? -1 : 1;
    return sortDirection === 'asc' ? comparison : -comparison;
  });

  const paginatedData = pagination
    ? sortedData.slice((currentPage - 1) * pageSize, currentPage * pageSize)
    : sortedData;

  const getValue = (row: T, column: Column<T>) => {
    // Support new API (cell function)
    if (column.cell) {
      return column.cell(row);
    }
    // Support legacy API (render function)
    const columnKey = (column.key || column.accessorKey) as keyof T;
    if (column.render) {
      return column.render(row[columnKey], row);
    }
    return row[columnKey];
  };

  return (
    <Card>
      {exportable && onExport && (
        <CardHeader className="flex flex-row items-center justify-end space-y-0 pb-4">
          <Button onClick={onExport} size="sm">
            Export CSV
          </Button>
        </CardHeader>
      )}
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                {columns.map((column, idx) => {
                  const columnKey = column.key || column.accessorKey;
                  const columnLabel = column.label || column.header || String(columnKey);
                  return (
                    <TableHead
                      key={String(columnKey) || idx}
                      className={(column.sortable || columnKey) ? 'cursor-pointer' : ''}
                      onClick={() => handleSort(column)}
                    >
                      <div className="flex items-center gap-2">
                        {columnLabel}
                        {(column.sortable || columnKey) && sortColumn === columnKey && (
                          <span className="text-muted-foreground">
                            {sortDirection === 'asc' ? '↑' : '↓'}
                          </span>
                        )}
                      </div>
                    </TableHead>
                  );
                })}
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedData.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={columns.length} className="text-center text-muted-foreground">
                    No data available
                  </TableCell>
                </TableRow>
              ) : (
                paginatedData.map((row, idx) => (
                  <TableRow
                    key={keyExtractor ? keyExtractor(row) : idx}
                    className={onRowClick ? 'cursor-pointer' : ''}
                    onClick={() => onRowClick?.(row)}
                  >
                    {columns.map((column, idx) => {
                      const columnKey = column.key || column.accessorKey;
                      return (
                        <TableCell key={String(columnKey) || idx}>
                          {getValue(row, column)}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
        {pagination && totalPages > 1 && (
          <div className="p-4 border-t flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              Showing {(currentPage - 1) * pageSize + 1} to {Math.min(currentPage * pageSize, safeData.length)} of{' '}
              {safeData.length} results
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

