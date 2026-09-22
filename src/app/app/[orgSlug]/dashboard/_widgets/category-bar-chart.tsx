"use client";

import { Bar, BarChart, CartesianGrid, Cell, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { formatCOP } from "@/lib/money";

// Paleta categórica del proyecto, orden fijo (dataviz: nunca ciclar/reordenar por rank).
const SERIES_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
  "var(--chart-6)",
  "var(--chart-7)",
  "var(--chart-8)",
];

// Barras horizontales genéricas para un ranking corto (gastos por categoría, planes que
// más venden): una sola magnitud por fila, con la etiqueta a la izquierda en vez de un
// eje — más legible que barras verticales cuando las etiquetas son texto largo.
export function CategoryBarChart({
  data,
  emptyLabel,
}: {
  data: { label: string; cents: number }[];
  emptyLabel: string;
}) {
  if (data.length === 0) {
    return <p className="text-muted-foreground py-8 text-center text-sm">{emptyLabel}</p>;
  }
  const total = data.reduce((a, d) => a + d.cents, 0);
  const summary = data.map((d) => `${d.label}: ${formatCOP(d.cents)}`).join("; ");

  return (
    <div role="img" aria-label={`Total ${formatCOP(total)}. ${summary}.`}>
      <ChartContainer config={{}} className="w-full" style={{ height: data.length * 36 + 24 }}>
        <BarChart data={data} layout="vertical" margin={{ left: 0, right: 24, top: 4, bottom: 4 }}>
          <CartesianGrid horizontal={false} strokeDasharray="3 3" className="stroke-border" />
          <XAxis type="number" hide />
          <YAxis
            type="category"
            dataKey="label"
            tickLine={false}
            axisLine={false}
            width={110}
            className="text-muted-foreground text-xs"
          />
          <ChartTooltip
            cursor={{ fill: "var(--muted)" }}
            content={<ChartTooltipContent formatter={(v) => formatCOP(Number(v))} hideLabel />}
          />
          <Bar dataKey="cents" radius={4} isAnimationActive animationDuration={400}>
            {data.map((d, i) => (
              <Cell key={d.label} fill={SERIES_COLORS[i % SERIES_COLORS.length]} />
            ))}
          </Bar>
        </BarChart>
      </ChartContainer>
    </div>
  );
}
