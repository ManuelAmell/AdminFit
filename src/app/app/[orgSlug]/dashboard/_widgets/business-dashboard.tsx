import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MoneyFlow } from "@/components/motion/money-flow";
import { StaggerGroup, StaggerItem } from "@/components/motion/stagger-list";
import { formatCOP } from "@/lib/money";
import { EXPENSE_CATEGORY_LABELS } from "@/modules/expenses/constants";
import {
  getExpenseBreakdown,
  getIncomeVsExpenses,
  getPlanPerformance,
  getRevenueSeries,
  type DashboardKpis,
} from "@/modules/reports/queries";
import { CategoryBarChart } from "./category-bar-chart";
import { IncomeExpenseChart } from "./income-expense-chart";
import { RevenueTrendChart } from "./revenue-trend-chart";

// Vista "Negocio" del dashboard (owner/admin, finance.read): KPIs + las gráficas que
// ayudan a manejar el gimnasio como negocio. Todas las queries corren en paralelo — es un
// Server Component async que el padre ya envuelve en <Suspense>.
export async function BusinessDashboard({
  orgId,
  base,
  kpis,
  canReadPayroll,
}: {
  orgId: string;
  base: string;
  kpis: DashboardKpis;
  canReadPayroll: boolean;
}) {
  const [revenueSeries, monthly, expenseBreakdown, planPerformance] = await Promise.all([
    getRevenueSeries(orgId, 14),
    getIncomeVsExpenses(orgId, 6),
    getExpenseBreakdown(orgId, { range: "month" }, !canReadPayroll),
    getPlanPerformance(orgId, { range: "month" }),
  ]);

  const kpiCards = [
    { label: "Ingresos del mes", cents: kpis.revenueCentsThisMonth, href: `${base}/payments` },
    { label: "Gastos del mes", cents: kpis.expenseCentsThisMonth, href: `${base}/expenses` },
    {
      label: "Utilidad del mes",
      cents: kpis.profitCentsThisMonth,
      href: `${base}/dashboard`,
      tone: kpis.profitCentsThisMonth >= 0 ? "success" : "destructive",
    },
    { label: "Por cobrar", cents: kpis.debtCents, href: `${base}/payments/debts` },
  ] as const;

  return (
    <div className="flex flex-col gap-6">
      <StaggerGroup
        aria-label="Indicadores del negocio"
        className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
      >
        {kpiCards.map((k, i) => (
          <StaggerItem index={i} key={k.label}>
            <Link href={k.href} className="block">
              <Card className="hover:border-primary/40 gap-1 py-4 transition-colors">
                <CardHeader className="pb-0">
                  <CardDescription>{k.label}</CardDescription>
                  <CardTitle
                    className={
                      "text-2xl tabular-nums " +
                      ("tone" in k && k.tone === "destructive" ? "text-destructive" : "")
                    }
                  >
                    <MoneyFlow cents={k.cents} />
                  </CardTitle>
                </CardHeader>
              </Card>
            </Link>
          </StaggerItem>
        ))}
      </StaggerGroup>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle role="heading" aria-level={2} className="text-base">
              Ingresos de los últimos 14 días
            </CardTitle>
            <CardDescription>{formatCOP(kpis.revenueCentsThisMonth)} este mes</CardDescription>
          </CardHeader>
          <CardContent>
            <RevenueTrendChart data={revenueSeries} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle role="heading" aria-level={2} className="text-base">
              Ingresos vs. gastos, últimos 6 meses
            </CardTitle>
            <CardDescription>Utilidad debajo, en la misma escala.</CardDescription>
          </CardHeader>
          <CardContent>
            <IncomeExpenseChart data={monthly} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle role="heading" aria-level={2} className="text-base">
              Gastos por categoría (este mes)
            </CardTitle>
            {!canReadPayroll && <CardDescription>No incluye nómina.</CardDescription>}
          </CardHeader>
          <CardContent>
            <CategoryBarChart
              data={expenseBreakdown.map((e) => ({
                label: EXPENSE_CATEGORY_LABELS[e.category],
                cents: e.cents,
              }))}
              emptyLabel="Aún no hay gastos este mes."
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle role="heading" aria-level={2} className="text-base">
              Planes que más venden (este mes)
            </CardTitle>
            <CardDescription>Por ingresos.</CardDescription>
          </CardHeader>
          <CardContent>
            <CategoryBarChart
              data={planPerformance.map((p) => ({ label: p.planName, cents: p.cents }))}
              emptyLabel="Aún no hay membresías vendidas este mes."
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
