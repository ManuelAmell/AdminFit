import type { Metadata } from "next";
import {
  AlertTriangle,
  Download,
  Flame,
  Lightbulb,
  LockKeyhole,
  Scale,
  TrendingDown,
  Vault,
} from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { MoneyFlow } from "@/components/motion/money-flow";
import { StaggerGroup, StaggerItem } from "@/components/motion/stagger-list";
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
import { can, requirePermission } from "@/lib/auth/authorize";
import { formatDate, todayISO } from "@/lib/dates";
import { formatCOP } from "@/lib/money";
import {
  buildCashDays,
  CASH_BALANCED_TOLERANCE_CENTS,
  CASH_DAY_STATUS_LABELS,
  CASH_MINOR_DIFF_CENTS,
  CASH_RANGE_LABELS,
  cashInsights,
  classifyDifference,
  parseCashRange,
  resolveCashRange,
  summarizeCashDays,
  type CashRange,
} from "@/modules/cash/analytics";
import {
  getCashierStats,
  getDailyCashMovements,
  getPaymentMethodMix,
  listClosuresInRange,
} from "@/modules/cash/queries";
import { cn } from "cn";
import {
  CashFlowChart,
  ExpectedVsCountedChart,
  MethodDonut,
  TodayWaterfall,
} from "./_components/cash-charts";
import { ClosureCalendar } from "./_components/closure-calendar";
import { CashRangePicker } from "./_components/range-picker";

export const metadata: Metadata = { title: "Centro de caja — AdminFit" };

const DIFF_BADGE = {
  balanced: "bg-success/15 text-success",
  minor: "bg-warning/20 text-warning-foreground dark:text-warning",
  over: "bg-info/15 text-info",
  short: "bg-destructive/15 text-destructive",
} as const;

function signedCOP(cents: number) {
  return `${cents > 0 ? "+" : cents < 0 ? "−" : ""}${formatCOP(Math.abs(cents))}`;
}

export default async function CashCenterPage(props: PageProps<"/app/[orgSlug]/cash">) {
  const { orgSlug } = await props.params;
  const sp = await props.searchParams;
  const ctx = await requirePermission(orgSlug, { cashClosure: ["readAll"] });
  const { org } = ctx;
  const canExport = can(ctx, { report: ["export"] });
  const range = parseCashRange(sp.range);
  const onlyDiffs = sp.diff === "1";
  const today = todayISO();
  const { fromISO, toISO } = resolveCashRange(range, today);

  const [{ closures, reopenedCount }, movements, methodMix, cashiers] = await Promise.all([
    listClosuresInRange(org.id, fromISO, toISO),
    getDailyCashMovements(org.id, fromISO, toISO),
    getPaymentMethodMix(org.id, fromISO, toISO),
    getCashierStats(org.id, fromISO, toISO, CASH_BALANCED_TOLERANCE_CENTS),
  ]);

  const days = buildCashDays({ fromISO, toISO, todayISO: today, closures, movements });
  const summary = summarizeCashDays(days);
  const insights = cashInsights(days, summary, methodMix).slice(0, 3);

  const todayDay = days.at(-1)!;
  const todayClosures = closures.filter((c) => c.businessDate === today);
  const todayOpening = todayClosures.reduce((a, c) => a + c.openingCashCents, 0);
  const todayExpected = todayOpening + todayDay.cashInCents - todayDay.cashOutCents;
  const todayClosed = todayClosures.length > 0;

  const base = `/app/${org.slug}`;
  const hrefFor = (r: CashRange, diff = onlyDiffs) =>
    `${base}/cash?range=${r}${diff ? "&diff=1" : ""}`;
  const tableRows = [...closures]
    .reverse()
    .filter((c) => !onlyDiffs || classifyDifference(c.differenceCents) !== "balanced");
  const maxCashier = Math.max(1, ...cashiers.map((c) => c.paymentsCents));

  const kpis = [
    {
      label: todayClosed ? "Efectivo contado hoy" : "Efectivo esperado hoy",
      icon: Vault,
      value: <MoneyFlow cents={todayClosed ? todayDay.countedCents : todayExpected} />,
      hint: todayClosed ? "Caja de hoy cerrada" : "En vivo · sin cerrar todavía",
      tone: "default",
    },
    {
      label: "Cierres cuadrados",
      icon: Scale,
      value: summary.balancedPct === null ? "—" : `${summary.balancedPct}%`,
      hint: `${summary.balancedDays} de ${summary.closedDays} cierres`,
      progress: summary.balancedPct ?? 0,
      tone: summary.balancedPct !== null && summary.balancedPct < 70 ? "warning" : "default",
    },
    {
      label: "Faltantes acumulados",
      icon: TrendingDown,
      value: <MoneyFlow cents={Math.abs(summary.shortCents)} />,
      hint: `Sobrantes ${formatCOP(summary.overCents)}`,
      tone: summary.shortCents < 0 ? "destructive" : "default",
    },
    {
      label: "Días sin cerrar",
      icon: LockKeyhole,
      value: String(summary.unclosedDays),
      hint: `${reopenedCount} ${reopenedCount === 1 ? "reapertura" : "reaperturas"}`,
      tone: summary.unclosedDays > 0 ? "warning" : "default",
    },
  ] as const;

  return (
    <>
      <PageHeader
        title="Centro de caja"
        description={`${CASH_RANGE_LABELS[range]} · ${formatDate(fromISO)} – ${formatDate(toISO)}`}
        actions={
          <>
            <div className="hidden md:block">
              <CashRangePicker value={range} hrefFor={(r) => hrefFor(r)} />
            </div>
            <Button
              size="sm"
              className="h-9"
              nativeButton={false}
              render={<Link href={`${base}/payments/cash-close`} />}
            >
              <LockKeyhole data-icon="inline-start" />
              <span className="hidden sm:inline">Cerrar caja</span>
            </Button>
          </>
        }
      />

      <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
        <div className="md:hidden">
          <CashRangePicker value={range} hrefFor={(r) => hrefFor(r)} />
        </div>

        <StaggerGroup
          aria-label="Indicadores de caja"
          className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
        >
          {kpis.map((k, i) => (
            <StaggerItem index={i} key={k.label}>
              <Card
                className={cn(
                  "relative gap-1 overflow-hidden py-4",
                  k.tone === "destructive" && "border-destructive/40",
                  k.tone === "warning" && "border-warning/50",
                )}
              >
                <CardHeader className="pb-0">
                  <CardDescription className="flex items-center gap-1.5">
                    <k.icon className="size-3.5" aria-hidden="true" />
                    {k.label}
                  </CardDescription>
                  <CardTitle
                    className={cn(
                      "text-2xl tabular-nums",
                      k.tone === "destructive" && "text-destructive",
                    )}
                  >
                    {k.value}
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-2">
                  <span className="text-muted-foreground text-xs">{k.hint}</span>
                  {"progress" in k && (
                    <div className="bg-muted h-1.5 overflow-hidden rounded-full" aria-hidden="true">
                      <div
                        className="bg-success h-full rounded-full transition-[width] duration-700"
                        style={{ width: `${k.progress}%` }}
                      />
                    </div>
                  )}
                </CardContent>
              </Card>
            </StaggerItem>
          ))}
        </StaggerGroup>

        {(insights.length > 0 || summary.balancedStreak >= 3) && (
          <Card className="from-primary/10 border-primary/30 bg-gradient-to-br to-transparent py-4">
            <CardContent className="flex flex-col gap-2">
              <p className="flex items-center gap-2 text-sm font-semibold">
                <Lightbulb className="text-primary size-4" aria-hidden="true" />
                Lectura rápida
                {summary.balancedStreak >= 3 && (
                  <Badge variant="secondary" className="ml-auto gap-1">
                    <Flame className="text-primary size-3" aria-hidden="true" />
                    Racha: {summary.balancedStreak} cuadrados
                  </Badge>
                )}
              </p>
              <ul className="text-muted-foreground flex flex-col gap-1 text-sm">
                {insights.map((t) => (
                  <li key={t} className="flex gap-2">
                    <span aria-hidden="true">•</span>
                    {t}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        <div className="grid gap-4 lg:grid-cols-5">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle role="heading" aria-level={2} className="text-base">
                Calendario de cierres
              </CardTitle>
              <CardDescription>Toca un día para ver o hacer su cierre.</CardDescription>
            </CardHeader>
            <CardContent>
              <ClosureCalendar days={days} closeHref={`${base}/payments/cash-close`} />
            </CardContent>
          </Card>
          <Card className="lg:col-span-3">
            <CardHeader>
              <CardTitle role="heading" aria-level={2} className="text-base">
                Esperado vs. contado
              </CardTitle>
              <CardDescription>
                Neto del periodo:{" "}
                <span
                  className={cn(
                    "font-medium tabular-nums",
                    summary.netDiffCents < 0 && "text-destructive",
                    summary.netDiffCents > 0 && "text-success",
                  )}
                >
                  {signedCOP(summary.netDiffCents)}
                </span>
                {summary.worstDay && (
                  <>
                    {" "}
                    · peor faltante el {formatDate(summary.worstDay.date)} (
                    {formatCOP(summary.worstDay.diffCents)})
                  </>
                )}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ExpectedVsCountedChart days={days} />
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle role="heading" aria-level={2} className="text-base">
                La caja de hoy
              </CardTitle>
              <CardDescription>
                {todayClosed
                  ? "Así se armó el efectivo del cierre de hoy."
                  : "Base en $0 hasta que se registre el cierre."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <TodayWaterfall
                openingCents={todayOpening}
                cashInCents={todayDay.cashInCents}
                cashOutCents={todayDay.cashOutCents}
                countedCents={todayClosed ? todayDay.countedCents : null}
              />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle role="heading" aria-level={2} className="text-base">
                ¿Cómo entra el dinero?
              </CardTitle>
              <CardDescription>Cobros por método de pago en el periodo.</CardDescription>
            </CardHeader>
            <CardContent>
              <MethodDonut data={methodMix} />
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle role="heading" aria-level={2} className="text-base">
              Entradas y salidas por día
            </CardTitle>
            <CardDescription>
              Arriba lo que se cobra (efectivo y otros medios); abajo los gastos pagados en
              efectivo.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <CashFlowChart days={days} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle role="heading" aria-level={2} className="text-base">
              Por cajero
            </CardTitle>
            <CardDescription>
              Lo que cobró cada persona, sus anulaciones y cómo le cuadraron sus cierres.
            </CardDescription>
          </CardHeader>
          <CardContent className="px-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-6">Persona</TableHead>
                    <TableHead className="min-w-40">Cobrado</TableHead>
                    <TableHead className="text-right">Efectivo</TableHead>
                    <TableHead className="text-right">Anulados</TableHead>
                    <TableHead className="text-right">Cierres</TableHead>
                    <TableHead className="pr-6 text-right">Descuadre</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cashiers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-muted-foreground pl-6">
                        Sin actividad en este periodo.
                      </TableCell>
                    </TableRow>
                  ) : (
                    cashiers.map((c) => (
                      <TableRow key={c.userId}>
                        <TableCell className="pl-6 font-medium">{c.name}</TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            <span className="tabular-nums">
                              {formatCOP(c.paymentsCents)}{" "}
                              <span className="text-muted-foreground text-xs">· {c.paymentsN}</span>
                            </span>
                            <div
                              className="bg-muted h-1 overflow-hidden rounded-full"
                              aria-hidden="true"
                            >
                              <div
                                className="bg-primary h-full rounded-full"
                                style={{ width: `${(c.paymentsCents / maxCashier) * 100}%` }}
                              />
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatCOP(c.cashCents)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {c.voidedN > 0 ? (
                            <span className="text-warning-foreground dark:text-warning font-medium">
                              {c.voidedN}
                            </span>
                          ) : (
                            0
                          )}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {c.closuresN}
                          {c.shortClosuresN > 0 && (
                            <span className="text-destructive ml-1 text-xs">
                              ({c.shortClosuresN} con faltante)
                            </span>
                          )}
                        </TableCell>
                        <TableCell
                          className={cn(
                            "pr-6 text-right font-medium tabular-nums",
                            c.diffCents < 0 && "text-destructive",
                            c.diffCents > 0 && "text-success",
                          )}
                        >
                          {c.closuresN ? signedCOP(c.diffCents) : "—"}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-wrap items-start justify-between gap-2">
            <div className="flex flex-col gap-1">
              <CardTitle role="heading" aria-level={2} className="text-base">
                Historial de cierres
              </CardTitle>
              <CardDescription>
                {closures.length} cierres · diferencias menores a {formatCOP(CASH_MINOR_DIFF_CENTS)}{" "}
                se marcan en ámbar.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant={onlyDiffs ? "secondary" : "outline"}
                size="sm"
                nativeButton={false}
                render={<Link href={hrefFor(range, !onlyDiffs)} scroll={false} />}
              >
                <AlertTriangle data-icon="inline-start" />
                {onlyDiffs ? "Ver todos" : "Solo descuadres"}
              </Button>
              {canExport && (
                <Button
                  variant="outline"
                  size="sm"
                  nativeButton={false}
                  render={<a href={`${base}/cash/export?range=${range}`} />}
                >
                  <Download data-icon="inline-start" />
                  CSV
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="px-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-6">Fecha</TableHead>
                    <TableHead>Sede</TableHead>
                    <TableHead>Cerró</TableHead>
                    <TableHead className="text-right">Base</TableHead>
                    <TableHead className="text-right">Esperado</TableHead>
                    <TableHead className="text-right">Contado</TableHead>
                    <TableHead className="pr-6 text-right">Diferencia</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tableRows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-muted-foreground pl-6">
                        {onlyDiffs
                          ? "Ningún cierre con descuadre. 🎉"
                          : "Sin cierres en este periodo."}
                      </TableCell>
                    </TableRow>
                  ) : (
                    tableRows.map((c) => {
                      const status = classifyDifference(c.differenceCents);
                      return (
                        <TableRow key={c.id}>
                          <TableCell className="pl-6">
                            <Link
                              href={`${base}/payments/cash-close?date=${c.businessDate}${c.branchId ? `&branchId=${c.branchId}` : ""}`}
                              className="underline-offset-4 hover:underline"
                            >
                              {formatDate(c.businessDate)}
                            </Link>
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {c.branchName ?? "—"}
                          </TableCell>
                          <TableCell>{c.closedByName ?? "—"}</TableCell>
                          <TableCell className="text-right tabular-nums">
                            {formatCOP(c.openingCashCents)}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {formatCOP(c.expectedCashCents)}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {formatCOP(c.countedCashCents)}
                          </TableCell>
                          <TableCell className="pr-6 text-right">
                            <span
                              className={cn(
                                "inline-flex rounded-md px-2 py-0.5 text-xs font-medium tabular-nums",
                                DIFF_BADGE[status],
                              )}
                              title={CASH_DAY_STATUS_LABELS[status]}
                            >
                              {signedCOP(c.differenceCents)}
                            </span>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
