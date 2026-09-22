"use client";

import { useState } from "react";
import AnimatedTabs from "@/components/smoothui/animated-tabs";
import { MoneyFlow } from "@/components/motion/money-flow";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CategoryBarChart } from "../dashboard/_widgets/category-bar-chart";
import { formatCOP } from "@/lib/money";
import { EXPENSE_CATEGORY_LABELS } from "@/modules/expenses/constants";
import {
  PAYMENT_CONCEPT_LABELS,
  PAYMENT_METHOD_LABELS,
  type PaymentConcept,
  type PaymentMethod,
} from "@/modules/payments/constants";
import type { MonthlySummary } from "@/modules/reports/queries";

function Delta({ current, previous }: { current: number; previous: number }) {
  if (previous === 0) return null;
  const pct = Math.round(((current - previous) / Math.abs(previous)) * 100);
  const positive = pct >= 0;
  return (
    <span className={positive ? "text-success" : "text-destructive"}>
      {positive ? "+" : ""}
      {pct}% vs. mes anterior
    </span>
  );
}

const TABS = [
  { id: "income", label: "Ingresos" },
  { id: "expenses", label: "Gastos" },
  { id: "profit", label: "Utilidad" },
];

export function ReportsTabs({ summary }: { summary: MonthlySummary }) {
  const [tab, setTab] = useState("income");

  return (
    <div className="flex flex-col gap-4">
      <AnimatedTabs activeTab={tab} onChange={setTab} variant="segment" tabs={TABS} />

      {tab === "income" && (
        <Card>
          <CardHeader>
            <CardTitle role="heading" aria-level={2} className="text-base">
              Ingresos
            </CardTitle>
            <CardDescription className="flex items-center gap-2 text-base">
              <span className="text-foreground font-semibold tabular-nums">
                <MoneyFlow cents={summary.incomeTotal} />
              </span>
              <Delta current={summary.incomeTotal} previous={summary.previous.incomeTotal} />
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-6">
            <div>
              <h3 className="text-muted-foreground mb-2 text-sm font-medium">Por concepto</h3>
              <CategoryBarChart
                data={summary.incomeByConcept.map((r) => ({
                  label: PAYMENT_CONCEPT_LABELS[r.concept as PaymentConcept],
                  cents: r.cents,
                }))}
                emptyLabel="Sin ingresos este mes."
              />
            </div>
            <div>
              <h3 className="text-muted-foreground mb-2 text-sm font-medium">Por método</h3>
              <CategoryBarChart
                data={summary.incomeByMethod.map((r) => ({
                  label: PAYMENT_METHOD_LABELS[r.method as PaymentMethod],
                  cents: r.cents,
                }))}
                emptyLabel="Sin ingresos este mes."
              />
            </div>
          </CardContent>
        </Card>
      )}

      {tab === "expenses" && (
        <Card>
          <CardHeader>
            <CardTitle role="heading" aria-level={2} className="text-base">
              Gastos
            </CardTitle>
            <CardDescription className="flex items-center gap-2 text-base">
              <span className="text-foreground font-semibold tabular-nums">
                <MoneyFlow cents={summary.expensesTotal} />
              </span>
              <Delta current={summary.expensesTotal} previous={summary.previous.expensesTotal} />
            </CardDescription>
          </CardHeader>
          <CardContent>
            <CategoryBarChart
              data={summary.expensesByCategory.map((r) => ({
                label: EXPENSE_CATEGORY_LABELS[r.category],
                cents: r.cents,
              }))}
              emptyLabel="Sin gastos este mes."
            />
          </CardContent>
        </Card>
      )}

      {tab === "profit" && (
        <Card>
          <CardHeader>
            <CardTitle role="heading" aria-level={2} className="text-base">
              Utilidad
            </CardTitle>
            <CardDescription>Ingresos menos gastos del mes.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <span
                className={
                  "text-3xl font-semibold tabular-nums " +
                  (summary.profitCents >= 0 ? "text-success" : "text-destructive")
                }
              >
                <MoneyFlow cents={summary.profitCents} />
              </span>
              <Delta current={summary.profitCents} previous={summary.previous.profitCents} />
            </div>
            <dl className="grid max-w-xs grid-cols-2 gap-y-1 text-sm">
              <dt className="text-muted-foreground">Ingresos</dt>
              <dd className="text-right tabular-nums">{formatCOP(summary.incomeTotal)}</dd>
              <dt className="text-muted-foreground">Gastos</dt>
              <dd className="text-right tabular-nums">{formatCOP(summary.expensesTotal)}</dd>
              <dt className="font-medium">Utilidad</dt>
              <dd className="text-right font-medium tabular-nums">
                {formatCOP(summary.profitCents)}
              </dd>
            </dl>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
