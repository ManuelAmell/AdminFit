"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Pie,
  PieChart,
  ReferenceLine,
  XAxis,
  YAxis,
} from "recharts";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { formatCOP, formatCOPShort } from "@/lib/money";
import type { CashDay } from "@/modules/cash/analytics";
import type { MethodSlice } from "@/modules/cash/queries";
import { PAYMENT_METHOD_LABELS, type PaymentMethod } from "@/modules/payments/constants";

// "2026-09-07" → "7/9"
function shortDay(iso: string) {
  return `${Number(iso.slice(8))}/${Number(iso.slice(5, 7))}`;
}

const moneyTooltip = <ChartTooltipContent formatter={(v) => formatCOP(Math.abs(Number(v)))} />;

function Empty({ children }: { children: string }) {
  return <p className="text-muted-foreground py-10 text-center text-sm">{children}</p>;
}

// ── Esperado vs. contado ──────────────────────────────────────────────────────────────
const expectedConfig = {
  expectedCents: { label: "Esperado", color: "var(--chart-1)" },
  countedCents: { label: "Contado", color: "var(--chart-3)" },
  diffCents: { label: "Diferencia" },
} satisfies ChartConfig;

// Barras pareadas por cierre + una tira de diferencia debajo en la misma escala de pesos
// (sin segundo eje, igual que IncomeExpenseChart).
export function ExpectedVsCountedChart({ days }: { days: CashDay[] }) {
  const rows = days
    .filter((d) => d.closures > 0)
    .map((d) => ({
      day: shortDay(d.date),
      expectedCents: d.expectedCents,
      countedCents: d.countedCents,
      diffCents: d.diffCents,
    }));
  if (rows.length === 0) return <Empty>Aún no hay cierres en este periodo.</Empty>;
  const net = rows.reduce((a, r) => a + r.diffCents, 0);

  return (
    <div
      role="img"
      aria-label={`${rows.length} cierres. Diferencia neta ${formatCOP(net)}.`}
      className="flex flex-col gap-1"
    >
      <ChartContainer config={expectedConfig} className="h-52 w-full">
        <BarChart data={rows} margin={{ left: 0, right: 8, top: 8 }} barGap={2}>
          <CartesianGrid vertical={false} strokeDasharray="3 3" className="stroke-border" />
          <XAxis dataKey="day" tickLine={false} axisLine={false} tickMargin={8} minTickGap={12} />
          <ChartTooltip content={moneyTooltip} />
          <ChartLegend content={<ChartLegendContent />} />
          <Bar dataKey="expectedCents" fill="var(--chart-1)" radius={[3, 3, 0, 0]} />
          <Bar dataKey="countedCents" fill="var(--chart-3)" radius={[3, 3, 0, 0]} />
        </BarChart>
      </ChartContainer>
      <p className="text-muted-foreground text-xs font-medium">Diferencia por cierre</p>
      <ChartContainer config={expectedConfig} className="h-24 w-full">
        <BarChart data={rows} margin={{ left: 0, right: 8, top: 4, bottom: 0 }}>
          <XAxis dataKey="day" hide />
          <ReferenceLine y={0} className="stroke-border" />
          <ChartTooltip
            content={
              <ChartTooltipContent
                formatter={(v) => `${Number(v) > 0 ? "+" : ""}${formatCOP(Number(v))}`}
              />
            }
          />
          <Bar dataKey="diffCents" radius={2}>
            {rows.map((r, i) => (
              <Cell key={i} fill={r.diffCents < 0 ? "var(--destructive)" : "var(--success)"} />
            ))}
          </Bar>
        </BarChart>
      </ChartContainer>
    </div>
  );
}

// ── Entradas y salidas de efectivo por día ───────────────────────────────────────────
const flowConfig = {
  cashInCents: { label: "Cobros en efectivo", color: "var(--chart-6)" },
  otherInCents: { label: "Otros medios", color: "var(--chart-1)" },
  cashOutCents: { label: "Gastos en efectivo", color: "var(--chart-8)" },
} satisfies ChartConfig;

// Barras divergentes (stackOffset "sign"): lo que entra hacia arriba, lo que sale en
// efectivo hacia abajo, sobre la misma línea base.
export function CashFlowChart({ days }: { days: CashDay[] }) {
  const rows = days.map((d) => ({
    day: shortDay(d.date),
    cashInCents: d.cashInCents,
    otherInCents: d.otherInCents,
    cashOutCents: -d.cashOutCents,
  }));
  const hasData = days.some((d) => d.cashInCents || d.otherInCents || d.cashOutCents);
  if (!hasData) return <Empty>Sin movimientos en este periodo.</Empty>;
  const totalIn = days.reduce((a, d) => a + d.cashInCents + d.otherInCents, 0);
  const totalOut = days.reduce((a, d) => a + d.cashOutCents, 0);

  return (
    <div
      role="img"
      aria-label={`Entradas ${formatCOP(totalIn)}; gastos en efectivo ${formatCOP(totalOut)}.`}
    >
      <ChartContainer config={flowConfig} className="h-64 w-full">
        <BarChart data={rows} stackOffset="sign" margin={{ left: 0, right: 8, top: 8 }}>
          <CartesianGrid vertical={false} strokeDasharray="3 3" className="stroke-border" />
          <XAxis dataKey="day" tickLine={false} axisLine={false} tickMargin={8} minTickGap={16} />
          <YAxis
            tickLine={false}
            axisLine={false}
            width={64}
            tickFormatter={(v) => formatCOPShort(Number(v))}
          />
          <ReferenceLine y={0} className="stroke-muted-foreground" />
          <ChartTooltip content={moneyTooltip} />
          <ChartLegend content={<ChartLegendContent />} />
          <Bar dataKey="cashInCents" stackId="a" fill="var(--chart-6)" />
          <Bar dataKey="otherInCents" stackId="a" fill="var(--chart-1)" radius={[3, 3, 0, 0]} />
          <Bar dataKey="cashOutCents" stackId="a" fill="var(--chart-8)" radius={[0, 0, 3, 3]} />
        </BarChart>
      </ChartContainer>
    </div>
  );
}

// ── Mezcla de métodos de pago ─────────────────────────────────────────────────────────
// Color fijo por método (nunca por ranking) para que el efectivo sea siempre el mismo verde.
export const METHOD_COLORS: Record<PaymentMethod, string> = {
  cash: "var(--chart-6)",
  transfer: "var(--chart-1)",
  card: "var(--chart-7)",
  other: "var(--chart-4)",
};

export function MethodDonut({ data }: { data: MethodSlice[] }) {
  const total = data.reduce((a, d) => a + d.cents, 0);
  if (total === 0) return <Empty>Sin cobros en este periodo.</Empty>;
  const config = Object.fromEntries(
    data.map((d) => [
      d.method,
      { label: PAYMENT_METHOD_LABELS[d.method], color: METHOD_COLORS[d.method] },
    ]),
  ) satisfies ChartConfig;
  const rows = data.map((d) => ({ ...d, label: PAYMENT_METHOD_LABELS[d.method] }));

  return (
    <div className="grid items-center gap-6 sm:grid-cols-[minmax(0,11rem)_1fr]">
      <div
        className="relative mx-auto aspect-square w-44"
        role="img"
        aria-label={`Total ${formatCOP(total)}`}
      >
        <ChartContainer config={config} className="aspect-square w-full">
          <PieChart>
            <ChartTooltip
              content={
                <ChartTooltipContent
                  nameKey="method"
                  hideLabel
                  formatter={(v) => formatCOP(Number(v))}
                />
              }
            />
            <Pie
              data={rows}
              dataKey="cents"
              nameKey="method"
              innerRadius="62%"
              outerRadius="100%"
              paddingAngle={2}
              strokeWidth={0}
            >
              {rows.map((r) => (
                <Cell key={r.method} fill={METHOD_COLORS[r.method]} />
              ))}
            </Pie>
          </PieChart>
        </ChartContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-muted-foreground text-[11px]">Total</span>
          <span className="text-base font-semibold tabular-nums">{formatCOPShort(total)}</span>
        </div>
      </div>
      <ul className="flex flex-col gap-3">
        {rows.map((r) => {
          const pct = Math.round((r.cents / total) * 100);
          return (
            <li key={r.method} className="flex flex-col gap-1">
              <div className="flex items-center justify-between gap-2 text-sm">
                <span className="flex items-center gap-2">
                  <span
                    className="size-2.5 rounded-full"
                    style={{ background: METHOD_COLORS[r.method] }}
                    aria-hidden="true"
                  />
                  {r.label}
                  <span className="text-muted-foreground text-xs">· {r.n} cobros</span>
                </span>
                <span className="font-medium tabular-nums">{pct}%</span>
              </div>
              <div className="bg-muted h-1.5 overflow-hidden rounded-full">
                <div
                  className="h-full rounded-full transition-[width] duration-700"
                  style={{ width: `${pct}%`, background: METHOD_COLORS[r.method] }}
                />
              </div>
              <span className="text-muted-foreground text-xs tabular-nums">
                {formatCOP(r.cents)}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// ── Cascada de la caja de hoy ─────────────────────────────────────────────────────────
// Base → + cobros en efectivo → − gastos en efectivo → esperado (→ contado si ya cerró).
// Cascada con barras apiladas: un tramo invisible (`offset`) levanta cada paso.
export function TodayWaterfall({
  openingCents,
  cashInCents,
  cashOutCents,
  countedCents,
}: {
  openingCents: number;
  cashInCents: number;
  cashOutCents: number;
  countedCents: number | null;
}) {
  const expected = openingCents + cashInCents - cashOutCents;
  const steps = [
    { step: "Base", offset: 0, value: openingCents, color: "var(--muted-foreground)" },
    { step: "Cobros", offset: openingCents, value: cashInCents, color: "var(--chart-6)" },
    {
      step: "Gastos",
      offset: Math.max(expected, 0),
      value: cashOutCents,
      color: "var(--chart-8)",
      negative: true,
    },
    { step: "Esperado", offset: 0, value: Math.max(expected, 0), color: "var(--chart-1)" },
    ...(countedCents !== null
      ? [{ step: "Contado", offset: 0, value: countedCents, color: "var(--chart-3)" }]
      : []),
  ];
  const config = { value: { label: "Monto" } } satisfies ChartConfig;

  return (
    <div role="img" aria-label={`Efectivo esperado hoy: ${formatCOP(expected)}.`}>
      <ChartContainer config={config} className="h-56 w-full">
        <BarChart data={steps} margin={{ left: 0, right: 8, top: 20 }}>
          <CartesianGrid vertical={false} strokeDasharray="3 3" className="stroke-border" />
          <XAxis dataKey="step" tickLine={false} axisLine={false} tickMargin={8} />
          <ChartTooltip
            cursor={{ fill: "var(--muted)" }}
            content={
              <ChartTooltipContent
                hideLabel
                formatter={(v, name, item) =>
                  name === "offset"
                    ? null
                    : `${item.payload.step}: ${item.payload.negative ? "−" : ""}${formatCOP(Number(v))}`
                }
              />
            }
          />
          <Bar dataKey="offset" stackId="w" fill="transparent" isAnimationActive={false} />
          <Bar dataKey="value" stackId="w" radius={4}>
            {steps.map((s) => (
              <Cell key={s.step} fill={s.color} />
            ))}
            <LabelList
              dataKey="value"
              position="top"
              className="fill-foreground text-[11px] font-medium"
              formatter={(v) => formatCOPShort(Number(v))}
            />
          </Bar>
        </BarChart>
      </ChartContainer>
    </div>
  );
}
