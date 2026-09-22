"use client";

import { Area, AreaChart, CartesianGrid, XAxis } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { formatCOP } from "@/lib/money";
import { formatDate } from "@/lib/dates";
import type { RevenuePoint } from "@/modules/reports/queries";

const config = {
  cents: { label: "Ingresos", color: "var(--chart-1)" },
} satisfies ChartConfig;

// Área: una sola serie (ingresos diarios), así que no necesita leyenda — el título de la
// tarjeta ya la nombra (dataviz: "un legend siempre presente para >= 2 series, ninguno
// para una"). Grid y eje recesivos; la marca es el área, no el eje.
export function RevenueTrendChart({ data }: { data: RevenuePoint[] }) {
  const total = data.reduce((a, p) => a + p.cents, 0);
  const summary = `Ingresos de los últimos ${data.length} días: ${formatCOP(total)} en total.`;

  return (
    <div role="img" aria-label={summary}>
      <ChartContainer config={config} className="h-56 w-full">
        <AreaChart data={data} margin={{ left: 0, right: 8, top: 8 }}>
          <defs>
            <linearGradient id="revenueFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="var(--chart-1)" stopOpacity={0.35} />
              <stop offset="95%" stopColor="var(--chart-1)" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} strokeDasharray="3 3" className="stroke-border" />
          <XAxis
            dataKey="date"
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            className="text-muted-foreground text-xs"
            tickFormatter={(v: string) => formatDate(v).replace(/\s\d{4}$/, "")}
            minTickGap={24}
          />
          <ChartTooltip
            content={
              <ChartTooltipContent
                labelFormatter={(v) => formatDate(String(v))}
                formatter={(value) => [formatCOP(Number(value)), " Ingresos"]}
              />
            }
          />
          <Area
            dataKey="cents"
            type="monotone"
            stroke="var(--chart-1)"
            strokeWidth={2}
            fill="url(#revenueFill)"
            isAnimationActive
            animationDuration={500}
          />
        </AreaChart>
      </ChartContainer>
    </div>
  );
}
