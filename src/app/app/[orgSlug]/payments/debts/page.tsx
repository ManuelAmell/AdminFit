import type { Metadata } from "next";
import { HandCoins, Receipt } from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import AnimatedProgressBar from "@/components/smoothui/animated-progress-bar";
import { StaggerTableBody, StaggerTableRow } from "@/components/motion/stagger-list";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { can, requirePermission } from "@/lib/auth/authorize";
import { daysUntil, formatDate } from "@/lib/dates";
import { formatCOP } from "@/lib/money";
import { listDebtors } from "@/modules/payments/queries";

export const metadata: Metadata = { title: "Cartera — AdminFit" };

export default async function DebtsPage(props: PageProps<"/app/[orgSlug]/payments/debts">) {
  const { orgSlug } = await props.params;
  const ctx = await requirePermission(orgSlug, { debt: ["read"] });
  const { org } = ctx;
  const debtors = await listDebtors(org.id);
  // El total agregado de cartera es una cifra del negocio: solo con finance.read (la fila
  // por fila es visible para todos con debt.read, porque Recepción la necesita para cobrar).
  const canSeeTotal = can(ctx, { finance: ["read"] });
  const total = debtors.reduce((acc, d) => acc + d.balanceCents, 0);
  const base = `/app/${org.slug}/payments`;

  return (
    <>
      <PageHeader title="Cartera" description="Socios con saldo pendiente" />
      <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
        {canSeeTotal && (
          <Card className="max-w-xs gap-1 py-4">
            <CardHeader className="pb-0">
              <CardDescription>Total por cobrar</CardDescription>
              <CardTitle className="text-2xl tabular-nums">{formatCOP(total)}</CardTitle>
            </CardHeader>
            <CardContent className="text-muted-foreground text-xs">
              {debtors.length} {debtors.length === 1 ? "socio" : "socios"}
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle role="heading" aria-level={2}>
              Socios con saldo
            </CardTitle>
            <CardDescription>
              Membresías activas, vencidas o congeladas sin pagar del todo.
            </CardDescription>
          </CardHeader>
          <CardContent className="px-0">
            {debtors.length === 0 ? (
              <div className="flex flex-col items-center gap-3 px-6 py-10 text-center">
                <HandCoins className="text-muted-foreground size-8" aria-hidden="true" />
                <p className="font-medium">No hay saldos pendientes</p>
                <p className="text-muted-foreground max-w-sm text-sm">
                  Todos los socios con membresía están al día.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="pl-6">Socio</TableHead>
                      <TableHead>Plan</TableHead>
                      <TableHead>Pagado</TableHead>
                      <TableHead className="text-right">Debe</TableHead>
                      <TableHead className="text-right">Desde</TableHead>
                      <TableHead className="pr-6" />
                    </TableRow>
                  </TableHeader>
                  <StaggerTableBody>
                    {debtors.map((d, index) => {
                      const paidPct = d.priceCents > 0 ? (d.paidCents / d.priceCents) * 100 : 0;
                      const daysSinceStart = Math.max(0, -daysUntil(d.startDate));
                      return (
                        <StaggerTableRow key={d.subscriptionId} index={index}>
                          <TableCell className="pl-6">
                            <Link
                              href={`/app/${org.slug}/members/${d.memberId}`}
                              className="font-medium underline-offset-4 hover:underline"
                            >
                              {d.memberFirstName} {d.memberLastName}
                            </Link>
                            <div className="text-muted-foreground text-xs">{d.memberDocument}</div>
                          </TableCell>
                          <TableCell className="text-muted-foreground">{d.planName}</TableCell>
                          <TableCell className="w-40">
                            <AnimatedProgressBar
                              value={paidPct}
                              color="var(--color-primary)"
                              label={`${formatCOP(d.paidCents)} de ${formatCOP(d.priceCents)}`}
                              labelClassName="text-muted-foreground text-xs font-normal"
                            />
                          </TableCell>
                          <TableCell className="text-destructive text-right font-medium tabular-nums">
                            {formatCOP(d.balanceCents)}
                          </TableCell>
                          <TableCell className="text-muted-foreground text-right text-xs tabular-nums">
                            {formatDate(d.startDate)} · {daysSinceStart}{" "}
                            {daysSinceStart === 1 ? "día" : "días"}
                          </TableCell>
                          <TableCell className="pr-6 text-right">
                            <Button
                              size="sm"
                              className="h-8"
                              nativeButton={false}
                              render={
                                <Link
                                  href={`${base}/new?memberId=${d.memberId}&subscriptionId=${d.subscriptionId}`}
                                />
                              }
                            >
                              <Receipt data-icon="inline-start" />
                              Cobrar
                            </Button>
                          </TableCell>
                        </StaggerTableRow>
                      );
                    })}
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
