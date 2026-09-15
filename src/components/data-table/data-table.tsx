"use client";

import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { useTableSearchParams } from "./use-table-search-params";

export type DataTableProps<TData> = {
  columns: ColumnDef<TData, unknown>[];
  data: TData[];
  total: number;
  page: number;
  pageSize: number;
  sort?: string;
  dir?: "asc" | "desc";
  emptyState: ReactNode;
  rowHref?: (row: TData) => string;
  onRowClick?: (row: TData) => void;
  className?: string;
};

// Tabla server-driven: orden y página viven en la URL (?sort=&dir=&page=).
export function DataTable<TData>({
  columns,
  data,
  total,
  page,
  pageSize,
  sort,
  dir = "asc",
  emptyState,
  onRowClick,
  className,
}: DataTableProps<TData>) {
  const { setParams, isPending } = useTableSearchParams();
  const sorting: SortingState = sort ? [{ id: sort, desc: dir === "desc" }] : [];

  // TanStack Table no es compatible con React Compiler; se desactiva la memoización aquí.
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    manualSorting: true,
    manualPagination: true,
    state: { sorting },
    pageCount: Math.max(1, Math.ceil(total / pageSize)),
  });

  const pageCount = table.getPageCount();
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  function toggleSort(columnId: string) {
    const isCurrent = sort === columnId;
    const nextDir = isCurrent && dir === "asc" ? "desc" : "asc";
    setParams({ sort: columnId, dir: nextDir });
  }

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <div className={cn("rounded-lg border", isPending && "opacity-60 transition-opacity")}>
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((hg) => (
              <TableRow key={hg.id} className="hover:bg-transparent">
                {hg.headers.map((header) => {
                  const canSort = header.column.getCanSort();
                  const isSorted = sort === header.column.id;
                  const ariaSort = isSorted ? (dir === "asc" ? "ascending" : "descending") : "none";
                  return (
                    <TableHead
                      key={header.id}
                      aria-sort={canSort ? ariaSort : undefined}
                      className={cn(
                        "first:pl-4 last:pr-4",
                        header.column.columnDef.meta?.className,
                      )}
                    >
                      {header.isPlaceholder ? null : canSort ? (
                        <button
                          type="button"
                          onClick={() => toggleSort(header.column.id)}
                          className="hover:text-foreground -ml-2 inline-flex h-8 items-center gap-1 rounded-md px-2 font-medium"
                        >
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          {isSorted ? (
                            dir === "asc" ? (
                              <ArrowUp className="size-3.5" aria-hidden="true" />
                            ) : (
                              <ArrowDown className="size-3.5" aria-hidden="true" />
                            )
                          ) : (
                            <ArrowUpDown
                              className="text-muted-foreground size-3.5"
                              aria-hidden="true"
                            />
                          )}
                        </button>
                      ) : (
                        flexRender(header.column.columnDef.header, header.getContext())
                      )}
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {data.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={columns.length} className="h-40 text-center whitespace-normal">
                  {emptyState}
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  onClick={onRowClick ? () => onRowClick(row.original) : undefined}
                  className={cn(onRowClick && "cursor-pointer")}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell
                      key={cell.id}
                      className={cn("first:pl-4 last:pr-4", cell.column.columnDef.meta?.className)}
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex flex-col items-center justify-between gap-3 sm:flex-row">
        <p className="text-muted-foreground text-sm tabular-nums" aria-live="polite">
          {total === 0 ? "Sin resultados" : `${from}–${to} de ${total}`}
        </p>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-9"
            disabled={page <= 1 || isPending}
            onClick={() => setParams({ page: page - 1 }, { resetPage: false })}
          >
            <ChevronLeft data-icon="inline-start" />
            Anterior
          </Button>
          <span className="text-muted-foreground text-sm tabular-nums">
            Página {page} de {pageCount}
          </span>
          <Button
            variant="outline"
            size="sm"
            className="h-9"
            disabled={page >= pageCount || isPending}
            onClick={() => setParams({ page: page + 1 }, { resetPage: false })}
          >
            Siguiente
            <ChevronRight data-icon="inline-end" />
          </Button>
        </div>
      </div>
    </div>
  );
}

export function DataTableSkeleton({ columns, rows = 8 }: { columns: number; rows?: number }) {
  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            {Array.from({ length: columns }).map((_, i) => (
              <TableHead key={i} className="first:pl-4 last:pr-4">
                <Skeleton className="h-4 w-24" />
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: rows }).map((_, r) => (
            <TableRow key={r}>
              {Array.from({ length: columns }).map((_, c) => (
                <TableCell key={c} className="first:pl-4 last:pr-4">
                  <Skeleton className="h-4 w-full max-w-40" />
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
