"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { UserPlus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo } from "react";
import { DataTable } from "@/components/data-table/data-table";
import { SearchInput } from "@/components/data-table/search-input";
import { useTableSearchParams } from "@/components/data-table/use-table-search-params";
import { MembershipBadge } from "@/components/members/membership-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatDate } from "@/lib/dates";
import { MEMBER_STATUS_LABELS } from "@/lib/members/labels";
import type { MemberRow } from "@/modules/members/queries";
import { MEMBER_STATUSES, type ListMembersParams } from "@/modules/members/schema";

const STATUS_ITEMS = [
  { value: "all", label: "Todos los estados" },
  ...MEMBER_STATUSES.map((s) => ({ value: s, label: MEMBER_STATUS_LABELS[s] })),
];

export function MembersTable({
  orgSlug,
  rows,
  total,
  params,
}: {
  orgSlug: string;
  rows: MemberRow[];
  total: number;
  params: ListMembersParams;
}) {
  const router = useRouter();
  const { setParams } = useTableSearchParams();
  const base = `/app/${orgSlug}/members`;

  const columns = useMemo<ColumnDef<MemberRow, unknown>[]>(
    () => [
      {
        id: "name",
        header: "Socio",
        enableSorting: true,
        cell: ({ row }) => (
          <div className="flex flex-col">
            <Link
              href={`${base}/${row.original.id}`}
              className="font-medium underline-offset-4 hover:underline"
            >
              {row.original.firstName} {row.original.lastName}
            </Link>
            <span className="text-muted-foreground text-xs">
              {row.original.phone ?? row.original.email ?? "—"}
            </span>
          </div>
        ),
      },
      {
        id: "document",
        header: "Documento",
        enableSorting: true,
        cell: ({ row }) => (
          <span className="tabular-nums">
            <span className="text-muted-foreground">{row.original.documentType}</span>{" "}
            {row.original.documentNumber}
          </span>
        ),
      },
      {
        id: "membership",
        header: "Membresía",
        enableSorting: false,
        cell: ({ row }) => (
          <div className="flex flex-col gap-0.5">
            <MembershipBadge state={row.original.membership} className="w-fit" />
            {row.original.endDate && (
              <span className="text-muted-foreground text-xs tabular-nums">
                Vence {formatDate(row.original.endDate)}
              </span>
            )}
          </div>
        ),
      },
      {
        id: "status",
        header: "Estado",
        enableSorting: false,
        cell: ({ row }) => (
          <Badge variant={row.original.status === "active" ? "outline" : "secondary"}>
            {MEMBER_STATUS_LABELS[row.original.status]}
          </Badge>
        ),
        meta: { className: "hidden md:table-cell" },
      },
      {
        id: "createdAt",
        header: "Registro",
        enableSorting: true,
        cell: ({ row }) => (
          <span className="text-muted-foreground tabular-nums">
            {formatDate(row.original.createdAt)}
          </span>
        ),
        meta: { className: "hidden lg:table-cell" },
      },
    ],
    [base],
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <SearchInput placeholder="Nombre, documento, teléfono…" label="Buscar socios" />
        <Select
          items={STATUS_ITEMS}
          value={params.status}
          onValueChange={(v) => setParams({ status: v === "all" ? null : v })}
        >
          <SelectTrigger className="h-10 w-full sm:w-48" aria-label="Filtrar por estado">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUS_ITEMS.map((i) => (
              <SelectItem key={i.value} value={i.value}>
                {i.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <DataTable
        columns={columns}
        data={rows}
        total={total}
        page={params.page}
        pageSize={params.pageSize}
        sort={params.sort}
        dir={params.dir}
        onRowClick={(m) => router.push(`${base}/${m.id}`)}
        emptyState={
          params.q || params.status !== "all" ? (
            <div className="flex flex-col items-center gap-2">
              <p className="font-medium">No encontramos socios con esos filtros.</p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setParams({ q: null, status: null })}
              >
                Limpiar filtros
              </Button>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3">
              <div className="bg-muted flex size-12 items-center justify-center rounded-full">
                <UserPlus className="text-muted-foreground size-5" aria-hidden="true" />
              </div>
              <div>
                <p className="font-medium">Aún no hay socios</p>
                <p className="text-muted-foreground text-sm">
                  Registra el primero o importa tu base desde un CSV.
                </p>
              </div>
              <div className="flex gap-2">
                <Button size="sm" nativeButton={false} render={<Link href={`${base}/new`} />}>
                  Nuevo socio
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  nativeButton={false}
                  render={<Link href={`${base}/import`} />}
                >
                  Importar CSV
                </Button>
              </div>
            </div>
          )
        }
      />
    </div>
  );
}
