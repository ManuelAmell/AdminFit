import type { Metadata } from "next";
import { Plus, Wallet } from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { StaggerTableBody, StaggerTableRow } from "@/components/motion/stagger-list";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { can, requirePermission } from "@/lib/auth/authorize";
import { dateTimeFmt } from "@/lib/dates";
import { formatCOP } from "@/lib/money";
import { EXPENSE_CATEGORY_LABELS, EXPENSE_STATUS_LABELS } from "@/modules/expenses/constants";
import { listExpenses } from "@/modules/expenses/queries";
import { expenseFiltersSchema } from "@/modules/expenses/schema";
import { ExpensesFilters } from "./expenses-filters";

export const metadata: Metadata = { title: "Gastos — AdminFit" };

export default async function ExpensesPage(props: PageProps<"/app/[orgSlug]/expenses">) {
  const { orgSlug } = await props.params;
  const sp = await props.searchParams;
  const ctx = await requirePermission(orgSlug, { expense: ["read"] });
  const { org } = ctx;

  const parsed = expenseFiltersSchema.safeParse({
    range: sp.range,
    from: sp.from,
    to: sp.to,
    category: sp.category,
    status: sp.status,
    page: sp.page,
    pageSize: sp.pageSize,
  });
  const filters = parsed.success ? parsed.data : expenseFiltersSchema.parse({});

  // Recepción (sin expense.readAll) solo ve sus propios gastos; sin expense.readPayroll
  // (admin), la categoría nómina queda fuera de la lista y de los totales — no solo
  // oculta en la UI, el query nunca la trae (ver Fase 5 slice 0).
  const canSeeAll = can(ctx, { expense: ["readAll"] });
  const canReadPayroll = can(ctx, { expense: ["readPayroll"] });
  const result = await listExpenses(org.id, filters, {
    recordedBy: canSeeAll ? undefined : ctx.userId,
    excludePayroll: !canReadPayroll,
  });
  const canCreate = can(ctx, { expense: ["create"] });
  const base = `/app/${org.slug}/expenses`;

  return (
    <>
      <PageHeader
        title="Gastos"
        description={org.name}
        actions={
          canCreate && (
            <Button
              size="sm"
              className="h-9"
              nativeButton={false}
              render={<Link href={`${base}/new`} />}
            >
              <Plus data-icon="inline-start" />
              Registrar gasto
            </Button>
          )
        }
      />
      <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
        <ExpensesFilters
          range={filters.range}
          from={filters.from}
          to={filters.to}
          category={filters.category}
          status={filters.status}
        />

        <Card className="max-w-xs gap-1 py-4">
          <CardHeader className="pb-0">
            <CardDescription>Total del periodo</CardDescription>
            <CardTitle className="text-2xl tabular-nums">
              {formatCOP(result.completedTotal)}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-muted-foreground text-xs">
            {result.total} {result.total === 1 ? "gasto" : "gastos"}
            {!canSeeAll && " (los tuyos)"}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle role="heading" aria-level={2}>
              Movimientos
            </CardTitle>
            <CardDescription>
              Página {result.page} de {result.pageCount}
            </CardDescription>
          </CardHeader>
          <CardContent className="px-0">
            {result.rows.length === 0 ? (
              <div className="flex flex-col items-center gap-3 px-6 py-10 text-center">
                <Wallet className="text-muted-foreground size-8" aria-hidden="true" />
                <p className="font-medium">No hay gastos en este periodo</p>
                <p className="text-muted-foreground max-w-sm text-sm">
                  Cambia el filtro de fechas o registra el primer gasto.
                </p>
                {canCreate && (
                  <Button
                    className="mt-1"
                    nativeButton={false}
                    render={<Link href={`${base}/new`} />}
                  >
                    <Plus data-icon="inline-start" />
                    Registrar gasto
                  </Button>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="pl-6">Fecha</TableHead>
                      <TableHead>Categoría</TableHead>
                      <TableHead>Descripción</TableHead>
                      {canSeeAll && <TableHead>Registró</TableHead>}
                      <TableHead className="text-right">Monto</TableHead>
                      <TableHead className="pr-6">Estado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <StaggerTableBody>
                    {result.rows.map((e, index) => (
                      <StaggerTableRow key={e.id} index={index}>
                        <TableCell className="pl-6 whitespace-nowrap">
                          <Link
                            href={`${base}/${e.id}`}
                            className="text-muted-foreground tabular-nums underline-offset-4 hover:underline"
                          >
                            {dateTimeFmt.format(e.spentAt)}
                          </Link>
                        </TableCell>
                        <TableCell>{EXPENSE_CATEGORY_LABELS[e.category]}</TableCell>
                        <TableCell>
                          <div className="flex flex-col leading-tight">
                            <span>{e.description}</span>
                            {e.branchName && (
                              <span className="text-muted-foreground text-xs">{e.branchName}</span>
                            )}
                          </div>
                        </TableCell>
                        {canSeeAll && (
                          <TableCell className="text-muted-foreground">
                            {e.recordedByName ?? "—"}
                          </TableCell>
                        )}
                        <TableCell
                          className={
                            "text-right font-medium tabular-nums " +
                            (e.status === "voided" ? "text-muted-foreground line-through" : "")
                          }
                        >
                          {formatCOP(e.amountCents)}
                        </TableCell>
                        <TableCell className="pr-6">
                          <Badge variant={e.status === "voided" ? "destructive" : "secondary"}>
                            {EXPENSE_STATUS_LABELS[e.status]}
                          </Badge>
                        </TableCell>
                      </StaggerTableRow>
                    ))}
                  </StaggerTableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
