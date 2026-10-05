"use client";

import { Bar, BarChart, CartesianGrid, Line, LineChart, XAxis } from "recharts";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { formatCOP } from "@/lib/money";
import type { MonthlyFinancials } from "@/modules/reports/queries";

const MONTH_LABELS = [
  "ene",
  "feb",
  "mar",
  "abr",
  "may",
  "jun",
  "jul",
  "ago",
  "sep",
  "oct",
  "nov",
  "dic",
];

function monthLabel(key: string) {
  const [, m] = key.split("-");
  return MONTH_LABELS[Number(m) - 1] ?? key;
}

const config = {
  incomeCents: { label: "Ingresos", color: "var(--chart-1)" },
  expenseCents: { label: "Gastos", color: "var(--chart-2)" },
  profitCents: { label: "Utilidad", color: "var(--chart-6)" },
} satisfies ChartConfig;

// Barras agrupadas (ingresos/gastos) + una línea de utilidad — nunca un segundo eje Y
// (regla #1 de dataviz): la utilidad se calcula en la MISMA escala de pesos, así que
// comparte eje sin problema. Dos gráficas superpuestas visualmente, un solo <XAxis/>.
export function IncomeExpenseChart({ data }: { data: MonthlyFinancials[] }) {
  const rows = data.map((d) => ({
    month: monthLabel(d.month),
    incomeCents: d.incomeCents,
    expenseCents: d.expenseCents,
    profitCents: d.incomeCents - d.expenseCents,
  }));
  const lastProfit = rows.at(-1)?.profitCents ?? 0;
  const summary = `Últimos ${rows.length} meses: utilidad del mes actual ${formatCOP(lastProfit)}.`;

  return (
    <div role="img" aria-label={summary} className="flex flex-col gap-2">
      <ChartContainer config={config} className="h-56 w-full">
        <BarChart data={rows} margin={{ left: 0, right: 8, top: 8 }}>
          <CartesianGrid vertical={false} strokeDasharray="3 3" className="stroke-border" />
          <XAxis
            dataKey="month"
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            className="text-muted-foreground text-xs"
          />
          <ChartTooltip content={<ChartTooltipContent formatter={(v) => formatCOP(Number(v))} />} />
          <ChartLegend content={<ChartLegendContent />} />
          <Bar
            dataKey="incomeCents"
            fill="var(--chart-1)"
            radius={[4, 4, 0, 0]}
            isAnimationActive
            animationDuration={400}
          />
          <Bar
            dataKey="expenseCents"
            fill="var(--chart-2)"
            radius={[4, 4, 0, 0]}
            isAnimationActive
            animationDuration={400}
          />
        </BarChart>
      </ChartContainer>
      {/* Utilidad en su propia mini-gráfica: misma escala de pesos que arriba, sin
          compartir ejes con las barras (evita el dual-axis, ver dataviz anti-patterns). */}
      <ChartContainer config={config} className="h-16 w-full">
        <LineChart data={rows} margin={{ left: 0, right: 8, top: 4, bottom: 0 }}>
          <XAxis dataKey="month" hide />
          <ChartTooltip content={<ChartTooltipContent formatter={(v) => formatCOP(Number(v))} />} />
          <Line
            dataKey="profitCents"
            stroke="var(--chart-6)"
            strokeWidth={2}
            dot={{ r: 3 }}
            isAnimationActive
            animationDuration={500}
          />
        </LineChart>
      </ChartContainer>
    </div>
  );
}
