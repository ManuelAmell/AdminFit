import type { Metadata } from "next";
import { CalendarDays, CreditCard, DollarSign, RefreshCw, UserCheck, Users } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ForbiddenError, roleCan } from "@/lib/auth/authorize";
import { requireOrg } from "@/lib/auth/session";
import { formatCOP } from "@/lib/money";
import { PAYMENT_METHOD_LABELS } from "@/modules/payments/constants";
import { getTenantReport } from "@/modules/reports/queries";
import { reportFiltersSchema } from "@/modules/reports/schema";
import { ExportButton } from "./export-button";
import { ReportsFilters } from "./reports-filters";

export const metadata: Metadata = { title: "Reportes — AdminFit" };

export default async function ReportsPage(props: PageProps<"/app/[orgSlug]/reports">) {
  const { orgSlug } = await props.params;
  const sp = await props.searchParams;
  const { org, role, isSuperadmin } = await requireOrg(orgSlug);

  if (!isSuperadmin && !roleCan(role, { report: ["read"] })) {
    throw new ForbiddenError();
  }

  const canExport = isSuperadmin || roleCan(role, { report: ["export"] });

  const parsed = reportFiltersSchema.safeParse({
    range: sp.range,
    from: sp.from,
    to: sp.to,
  });
  const filters = parsed.success ? parsed.data : reportFiltersSchema.parse({});

  const report = await getTenantReport(org.id, filters);

  const kpis = [
    {
      label: "Total recaudado",
      value: formatCOP(report.summary.totalRevenueCents),
      subtext: `${report.summary.totalPayments} pagos registrados`,
      icon: DollarSign,
    },
    {
      label: "Altas de socios",
      value: String(report.summary.newMembersCount),
      subtext: "Registrados en el periodo",
      icon: Users,
    },
    {
      label: "Renovaciones",
      value: String(report.summary.renewalsCount),
      subtext: "Membresías renovadas",
      icon: RefreshCw,
    },
    {
      label: "Vencimientos",
      value: String(report.summary.expirationsCount),
      subtext: "Finalizan en el periodo",
      icon: CalendarDays,
    },
  ];

  return (
    <>
      <PageHeader
        title="Reportes"
        description={org.name}
        actions={
          <ExportButton
            orgSlug={org.slug}
            range={filters.range}
            from={filters.from}
            to={filters.to}
            canExport={canExport}
          />
        }
      />

      <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <ReportsFilters range={filters.range} from={filters.from} to={filters.to} />
          <Badge variant="outline" className="w-fit text-xs font-normal">
            Periodo: {report.dateRange.fromISO} al {report.dateRange.toISO}
          </Badge>
        </div>

        {/* Tarjetas de Indicadores Clave */}
        <section
          aria-label="Indicadores del periodo"
          className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
        >
          {kpis.map((k) => (
            <Card key={k.label} className="gap-1 py-4">
              <CardHeader className="pb-0">
                <div className="flex items-center justify-between">
                  <CardDescription>{k.label}</CardDescription>
                  <k.icon className="text-muted-foreground size-4" aria-hidden="true" />
                </div>
                <CardTitle className="text-2xl font-semibold tabular-nums">{k.value}</CardTitle>
                <p className="text-muted-foreground text-xs">{k.subtext}</p>
              </CardHeader>
            </Card>
          ))}
        </section>

        {/* Tablas de Ingresos: Por Plan y Por Método */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Ingresos por Plan */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <CreditCard className="text-primary size-4" aria-hidden="true" />
                <CardTitle role="heading" aria-level={2} className="text-base">
                  Ingresos por plan
                </CardTitle>
              </div>
              <CardDescription>
                Distribución de ingresos generados según cada plan de membresía.
              </CardDescription>
            </CardHeader>
            <CardContent className="px-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-6">Plan</TableHead>
                    <TableHead className="text-center">Pagos</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="pr-6 text-right">Part.</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {report.byPlan.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-muted-foreground pl-6 text-sm">
                        No hay ingresos registrados en este periodo.
                      </TableCell>
                    </TableRow>
                  ) : (
                    report.byPlan.map((p) => (
                      <TableRow key={p.planId}>
                        <TableCell className="pl-6 font-medium">{p.planName}</TableCell>
                        <TableCell className="text-center tabular-nums">{p.count}</TableCell>
                        <TableCell className="text-right font-medium tabular-nums">
                          {formatCOP(p.totalCents)}
                        </TableCell>
                        <TableCell className="text-muted-foreground pr-6 text-right tabular-nums">
                          {p.percentage.toFixed(1)}%
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Ingresos por Método de Pago */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <UserCheck className="text-primary size-4" aria-hidden="true" />
                <CardTitle role="heading" aria-level={2} className="text-base">
                  Ingresos por método de pago
                </CardTitle>
              </div>
              <CardDescription>
                Desglose según el medio de recepción (efectivo, transferencia, tarjeta).
              </CardDescription>
            </CardHeader>
            <CardContent className="px-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-6">Método</TableHead>
                    <TableHead className="text-center">Pagos</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="pr-6 text-right">Part.</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {report.byMethod.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-muted-foreground pl-6 text-sm">
                        No hay pagos registrados en este periodo.
                      </TableCell>
                    </TableRow>
                  ) : (
                    report.byMethod.map((m) => (
                      <TableRow key={m.method}>
                        <TableCell className="pl-6 font-medium">
                          {PAYMENT_METHOD_LABELS[m.method] ?? m.method}
                        </TableCell>
                        <TableCell className="text-center tabular-nums">{m.count}</TableCell>
                        <TableCell className="text-right font-medium tabular-nums">
                          {formatCOP(m.totalCents)}
                        </TableCell>
                        <TableCell className="text-muted-foreground pr-6 text-right tabular-nums">
                          {m.percentage.toFixed(1)}%
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
