import type { Metadata } from "next";
import { Banknote, CalendarCheck, Receipt, Users } from "lucide-react";
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
import { requireOrg } from "@/lib/auth/session";
import { formatCOP } from "@/lib/money";
import { PAYMENT_METHOD_LABELS, type PaymentMethod } from "@/modules/payments/constants";
import { PLAN_COLOR_DOT, type PlanColor } from "@/modules/plans/schema";
import { getDetailedReportsData } from "@/modules/reports/queries";

export const metadata: Metadata = { title: "Reportes — AdminFit" };

export default async function ReportsPage({ params }: PageProps<"/app/[orgSlug]/reports">) {
  const { orgSlug } = await params;
  const { org } = await requireOrg(orgSlug);
  const base = `/app/${org.slug}`;

  const data = await getDetailedReportsData(org.id);
  const {
    kpis,
    monthlyRevenue,
    byMethod,
    plansPopularity,
    membersTotal,
    membersActive,
    totalCollectedAllTime,
  } = data;

  const maxMonthCents = Math.max(...monthlyRevenue.map((m) => m.totalCents), 1);

  const kpisCards = [
    {
      label: "Ingresos este mes",
      value: formatCOP(kpis.revenueCentsThisMonth),
      description: "Recaudado en el mes calendario actual",
      icon: Receipt,
      href: `${base}/payments`,
    },
    {
      label: "Total recaudado histórico",
      value: formatCOP(totalCollectedAllTime),
      description: "Total acumulado de pagos completados",
      icon: Banknote,
      href: `${base}/payments`,
    },
    {
      label: "Socios activos",
      value: `${membersActive} / ${membersTotal}`,
      description: `${membersTotal > 0 ? Math.round((membersActive / membersTotal) * 100) : 0}% de los socios registrados`,
      icon: Users,
      href: `${base}/members`,
    },
    {
      label: "Membresías vigentes",
      value: String(kpis.counts.active),
      description: `${kpis.counts.expiring} por vencer en los próximos 5 días`,
      icon: CalendarCheck,
      href: `${base}/memberships?filter=active`,
    },
  ];

  return (
    <>
      <PageHeader
        title="Reportes"
        description={`Métricas y balances financieros de ${org.name}`}
        actions={
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              nativeButton={false}
              render={<Link href={`${base}/payments/cash-close`} />}
            >
              Cierre de caja
            </Button>
            <Button
              variant="outline"
              size="sm"
              nativeButton={false}
              render={<Link href={`${base}/payments`} />}
            >
              Ver pagos
            </Button>
          </div>
        }
      />

      <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
        {/* KPIs Principales */}
        <section
          aria-label="Indicadores clave"
          className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
        >
          {kpisCards.map((k) => (
            <Link key={k.label} href={k.href} className="block">
              <Card className="hover:border-primary/40 gap-1 py-4 transition-colors">
                <CardHeader className="pb-1">
                  <div className="flex items-center justify-between">
                    <CardDescription>{k.label}</CardDescription>
                    <k.icon className="text-muted-foreground size-4" />
                  </div>
                  <CardTitle className="text-2xl tabular-nums">{k.value}</CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <p className="text-muted-foreground text-xs">{k.description}</p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </section>

        {/* Sección 1: Historial de Ingresos y Métodos de Pago */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Evolución mensual */}
          <Card>
            <CardHeader>
              <CardTitle role="heading" aria-level={2} className="text-base">
                Ingresos mensuales (Últimos 6 meses)
              </CardTitle>
              <CardDescription>Comportamiento de la recaudación por mes calendario</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-4">
                {monthlyRevenue.map((m) => {
                  const percent = Math.round((m.totalCents / maxMonthCents) * 100);
                  return (
                    <div key={m.key} className="flex flex-col gap-1.5">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium">{m.label}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground text-xs">
                            {m.count} {m.count === 1 ? "pago" : "pagos"}
                          </span>
                          <span className="font-semibold tabular-nums">
                            {formatCOP(m.totalCents)}
                          </span>
                        </div>
                      </div>
                      <div className="bg-muted h-2.5 w-full overflow-hidden rounded-full">
                        <div
                          className="bg-primary h-full rounded-full transition-all"
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Ingresos por método de pago */}
          <Card>
            <CardHeader>
              <CardTitle role="heading" aria-level={2} className="text-base">
                Recaudación por método de pago
              </CardTitle>
              <CardDescription>Distribución acumulada de pagos completados</CardDescription>
            </CardHeader>
            <CardContent>
              {byMethod.length === 0 ? (
                <p className="text-muted-foreground text-sm">No hay pagos registrados aún.</p>
              ) : (
                <div className="flex flex-col gap-4">
                  {byMethod.map((item) => {
                    const percent =
                      totalCollectedAllTime > 0
                        ? Math.round((item.totalCents / totalCollectedAllTime) * 100)
                        : 0;
                    const label =
                      PAYMENT_METHOD_LABELS[item.method as PaymentMethod] ?? item.method;
                    return (
                      <div key={item.method} className="flex flex-col gap-1.5">
                        <div className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{label}</span>
                            <Badge variant="outline" className="text-xs">
                              {percent}%
                            </Badge>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-muted-foreground text-xs">
                              {item.count} {item.count === 1 ? "transacción" : "transacciones"}
                            </span>
                            <span className="font-semibold tabular-nums">
                              {formatCOP(item.totalCents)}
                            </span>
                          </div>
                        </div>
                        <div className="bg-muted h-2.5 w-full overflow-hidden rounded-full">
                          <div
                            className="bg-primary/80 h-full rounded-full transition-all"
                            style={{ width: `${percent}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sección 2: Membresías por Plan y Estado */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Planes más populares */}
          <Card>
            <CardHeader>
              <CardTitle role="heading" aria-level={2} className="text-base">
                Distribución por planes
              </CardTitle>
              <CardDescription>
                Planes con mayor cantidad de membresías activas vigentes
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {plansPopularity.length === 0 ? (
                <p className="text-muted-foreground p-6 text-sm">No hay planes creados aún.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="pl-6">Plan</TableHead>
                      <TableHead>Tarifa</TableHead>
                      <TableHead className="pr-6 text-right">Membresías activas</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {plansPopularity.map((p) => {
                      const dotClass = PLAN_COLOR_DOT[p.color as PlanColor] ?? "bg-primary";
                      return (
                        <TableRow key={p.id}>
                          <TableCell className="pl-6 font-medium">
                            <div className="flex items-center gap-2">
                              <span className={`size-2.5 rounded-full ${dotClass}`} />
                              <span>{p.name}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-muted-foreground tabular-nums">
                            {formatCOP(p.priceCents)}
                          </TableCell>
                          <TableCell className="pr-6 text-right font-semibold tabular-nums">
                            {p.activeCount}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* Estado de Membresías */}
          <Card>
            <CardHeader>
              <CardTitle role="heading" aria-level={2} className="text-base">
                Estado general de membresías
              </CardTitle>
              <CardDescription>Resumen de suscripciones para retención y cobranza</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 sm:grid-cols-2">
                <Link
                  href={`${base}/memberships?filter=active`}
                  className="bg-card hover:bg-muted/50 flex flex-col gap-1 rounded-lg border p-3 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Al día</span>
                    <Badge
                      variant="outline"
                      className="border-emerald-500/30 text-emerald-600 dark:text-emerald-400"
                    >
                      Activas
                    </Badge>
                  </div>
                  <span className="text-2xl font-bold tabular-nums">{kpis.counts.active}</span>
                </Link>

                <Link
                  href={`${base}/memberships?filter=expiring`}
                  className="bg-card hover:bg-muted/50 flex flex-col gap-1 rounded-lg border p-3 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Por vencer</span>
                    <Badge
                      variant="outline"
                      className="border-amber-500/30 text-amber-600 dark:text-amber-400"
                    >
                      5 días
                    </Badge>
                  </div>
                  <span className="text-2xl font-bold tabular-nums">{kpis.counts.expiring}</span>
                </Link>

                <Link
                  href={`${base}/memberships?filter=expired`}
                  className="bg-card hover:bg-muted/50 flex flex-col gap-1 rounded-lg border p-3 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Vencidas</span>
                    <Badge variant="secondary">Expiradas</Badge>
                  </div>
                  <span className="text-2xl font-bold tabular-nums">{kpis.counts.expired}</span>
                </Link>

                <Link
                  href={`${base}/memberships?filter=frozen`}
                  className="bg-card hover:bg-muted/50 flex flex-col gap-1 rounded-lg border p-3 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Congeladas</span>
                    <Badge
                      variant="outline"
                      className="border-blue-500/30 text-blue-600 dark:text-blue-400"
                    >
                      Pausa
                    </Badge>
                  </div>
                  <span className="text-2xl font-bold tabular-nums">{kpis.counts.frozen}</span>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
