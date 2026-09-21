import type { Metadata } from "next";
import { ChevronLeft, ChevronRight, ClipboardList, Plus, Receipt } from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { roleCan } from "@/lib/auth/authorize";
import { requireOrg } from "@/lib/auth/session";
import { dateTimeFmt } from "@/lib/dates";
import { formatCOP } from "@/lib/money";
import {
  PAYMENT_METHOD_LABELS,
  PAYMENT_STATUS_LABELS,
  type PaymentMethod,
} from "@/modules/payments/constants";
import { listPayments } from "@/modules/payments/queries";
import { paymentFiltersSchema } from "@/modules/payments/schema";
import { PaymentsFilters } from "./payments-filters";

export const metadata: Metadata = { title: "Pagos — AdminFit" };

export default async function PaymentsPage(props: PageProps<"/app/[orgSlug]/payments">) {
  const { orgSlug } = await props.params;
  const sp = await props.searchParams;
  const { org, role, isSuperadmin } = await requireOrg(orgSlug);

  const parsed = paymentFiltersSchema.safeParse({
    range: sp.range,
    from: sp.from,
    to: sp.to,
    method: sp.method,
    status: sp.status,
    memberId: sp.memberId,
    page: sp.page,
    pageSize: sp.pageSize,
  });
  const filters = parsed.success ? parsed.data : paymentFiltersSchema.parse({});
  const result = await listPayments(org.id, filters);
  const canCreate = isSuperadmin || roleCan(role, { payment: ["create"] });
  const base = `/app/${org.slug}/payments`;

  const qs = (page: number) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(sp)) if (typeof v === "string" && k !== "page") p.set(k, v);
    p.set("page", String(page));
    return `${base}?${p.toString()}`;
  };

  const byMethod = result.totals.filter((t) => t.status === "completed");

  return (
    <>
      <PageHeader
        title="Pagos"
        description={org.name}
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              className="h-9"
              nativeButton={false}
              render={<Link href={`${base}/cash-close`} />}
            >
              <ClipboardList data-icon="inline-start" />
              <span className="hidden sm:inline">Cierre de caja</span>
            </Button>
            {canCreate && (
              <Button
                size="sm"
                className="h-9"
                nativeButton={false}
                render={<Link href={`${base}/new`} />}
              >
                <Plus data-icon="inline-start" />
                Registrar pago
              </Button>
            )}
          </>
        }
      />
      <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
        <PaymentsFilters
          range={filters.range}
          from={filters.from}
          to={filters.to}
          method={filters.method}
          status={filters.status}
        />

        <section
          aria-label="Totales del periodo"
          className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
        >
          <Card className="gap-1 py-4">
            <CardHeader className="pb-0">
              <CardDescription>Total cobrado</CardDescription>
              <CardTitle className="text-2xl tabular-nums">
                {formatCOP(result.completedTotal)}
              </CardTitle>
            </CardHeader>
            <CardContent className="text-muted-foreground text-xs">
              {result.total} {result.total === 1 ? "pago" : "pagos"} en el periodo
            </CardContent>
          </Card>
          {byMethod.slice(0, 3).map((t) => (
            <Card key={t.method} className="gap-1 py-4">
              <CardHeader className="pb-0">
                <CardDescription>
                  {PAYMENT_METHOD_LABELS[t.method as PaymentMethod]}
                </CardDescription>
                <CardTitle className="text-2xl tabular-nums">{formatCOP(t.total ?? 0)}</CardTitle>
              </CardHeader>
              <CardContent className="text-muted-foreground text-xs">
                {t.n} {t.n === 1 ? "pago" : "pagos"}
              </CardContent>
            </Card>
          ))}
        </section>

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
                <Receipt className="text-muted-foreground size-8" aria-hidden="true" />
                <p className="font-medium">No hay pagos en este periodo</p>
                <p className="text-muted-foreground max-w-sm text-sm">
                  Cambia el filtro de fechas o registra el primer pago del día.
                </p>
                {canCreate && (
                  <Button
                    className="mt-1"
                    nativeButton={false}
                    render={<Link href={`${base}/new`} />}
                  >
                    <Plus data-icon="inline-start" />
                    Registrar pago
                  </Button>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="pl-6">Recibo</TableHead>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Socio</TableHead>
                      <TableHead>Método</TableHead>
                      <TableHead>Recibió</TableHead>
                      <TableHead className="text-right">Monto</TableHead>
                      <TableHead className="pr-6">Estado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {result.rows.map((p) => (
                      <TableRow key={p.id} data-payment-id={p.id}>
                        <TableCell className="pl-6 font-mono text-xs">
                          <Link
                            href={`${base}/${p.id}`}
                            className="underline-offset-4 hover:underline"
                          >
                            #{String(p.receiptNumber).padStart(6, "0")}
                          </Link>
                        </TableCell>
                        <TableCell className="text-muted-foreground whitespace-nowrap tabular-nums">
                          {dateTimeFmt.format(p.paidAt)}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col leading-tight">
                            <span className="font-medium">
                              {p.memberFirstName} {p.memberLastName}
                            </span>
                            <span className="text-muted-foreground text-xs">
                              {p.memberDocument}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col leading-tight">
                            <span>{PAYMENT_METHOD_LABELS[p.method]}</span>
                            {p.reference && (
                              <span className="text-muted-foreground font-mono text-xs">
                                {p.reference}
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {p.receivedByName ?? "—"}
                        </TableCell>
                        <TableCell
                          className={
                            "text-right font-medium tabular-nums " +
                            (p.status === "voided" ? "text-muted-foreground line-through" : "")
                          }
                        >
                          {formatCOP(p.amountCents)}
                        </TableCell>
                        <TableCell className="pr-6">
                          <Badge variant={p.status === "voided" ? "destructive" : "secondary"}>
                            {PAYMENT_STATUS_LABELS[p.status]}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
            {result.pageCount > 1 && (
              <nav
                className="flex items-center justify-end gap-2 px-6 pt-4"
                aria-label="Paginación"
              >
                <Button
                  variant="outline"
                  size="sm"
                  disabled={result.page <= 1}
                  nativeButton={false}
                  render={<Link href={qs(result.page - 1)} aria-disabled={result.page <= 1} />}
                >
                  <ChevronLeft data-icon="inline-start" /> Anterior
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={result.page >= result.pageCount}
                  nativeButton={false}
                  render={<Link href={qs(result.page + 1)} />}
                >
                  Siguiente <ChevronRight data-icon="inline-end" />
                </Button>
              </nav>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
