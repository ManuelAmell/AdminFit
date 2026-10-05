import { addDaysISO } from "@/lib/dates";

// Lógica pura del Centro de caja (Fase 6.A): clasifica cierres y arma la serie diaria.
// Sin DB ni React para poder testearla en unit (tests/unit/cash-analytics.test.ts).

// Hasta aquí una diferencia se considera "cuadrado" (monedas, redondeos). Cuando exista
// `org_settings.cash_tolerance_cents` (migración 0009) se leerá de ahí.
export const CASH_BALANCED_TOLERANCE_CENTS = 1_000_00;
// Hasta aquí una diferencia es "menor" (ámbar); por encima, faltante/sobrante serio.
export const CASH_MINOR_DIFF_CENTS = 20_000_00;

export const CASH_RANGES = ["7", "30", "90", "month"] as const;
export type CashRange = (typeof CASH_RANGES)[number];
export const CASH_RANGE_LABELS: Record<CashRange, string> = {
  "7": "7 días",
  "30": "30 días",
  "90": "90 días",
  month: "Este mes",
};

export function parseCashRange(value: unknown): CashRange {
  return CASH_RANGES.includes(value as CashRange) ? (value as CashRange) : "30";
}

// Rango de fechas de negocio que termina hoy (incluido).
export function resolveCashRange(range: CashRange, today: string) {
  const fromISO =
    range === "month" ? `${today.slice(0, 7)}-01` : addDaysISO(today, -(Number(range) - 1));
  return { fromISO, toISO: today };
}

export type CashDayStatus =
  | "balanced" // cerrado, |diferencia| ≤ tolerancia
  | "minor" // cerrado, diferencia chica en cualquier sentido
  | "short" // cerrado, faltante serio
  | "over" // cerrado, sobrante serio
  | "unclosed" // hubo efectivo y nadie cerró (día pasado)
  | "pending" // hoy, aún sin cerrar
  | "idle"; // sin movimientos ni cierre

export const CASH_DAY_STATUS_LABELS: Record<CashDayStatus, string> = {
  balanced: "Cuadrado",
  minor: "Diferencia menor",
  short: "Faltante",
  over: "Sobrante",
  unclosed: "Sin cerrar",
  pending: "Pendiente (hoy)",
  idle: "Sin movimiento",
};

export function classifyDifference(
  diffCents: number,
  tolerance = CASH_BALANCED_TOLERANCE_CENTS,
): "balanced" | "minor" | "short" | "over" {
  const abs = Math.abs(diffCents);
  if (abs <= tolerance) return "balanced";
  if (abs <= CASH_MINOR_DIFF_CENTS) return "minor";
  return diffCents < 0 ? "short" : "over";
}

// Peor primero: con varias sedes, el día toma el estado de su peor cierre.
const SEVERITY: Record<ReturnType<typeof classifyDifference>, number> = {
  balanced: 0,
  minor: 1,
  over: 2,
  short: 3,
};

export type ClosureLite = {
  businessDate: string;
  expectedCashCents: number;
  countedCashCents: number;
  differenceCents: number;
};

export type DayMovement = {
  date: string;
  cashInCents: number; // cobros en efectivo
  otherInCents: number; // cobros por otros métodos
  cashOutCents: number; // gastos en efectivo
};

export type CashDay = {
  date: string;
  status: CashDayStatus;
  closures: number;
  expectedCents: number;
  countedCents: number;
  diffCents: number;
  cashInCents: number;
  otherInCents: number;
  cashOutCents: number;
};

export function buildCashDays(input: {
  fromISO: string;
  toISO: string;
  todayISO: string;
  closures: ClosureLite[];
  movements: DayMovement[];
}): CashDay[] {
  const byDate = new Map<string, ClosureLite[]>();
  for (const c of input.closures) {
    const list = byDate.get(c.businessDate) ?? [];
    list.push(c);
    byDate.set(c.businessDate, list);
  }
  const moves = new Map(input.movements.map((m) => [m.date, m]));

  const out: CashDay[] = [];
  for (let d = input.fromISO; d <= input.toISO; d = addDaysISO(d, 1)) {
    const cs = byDate.get(d) ?? [];
    const m = moves.get(d);
    const cashIn = m?.cashInCents ?? 0;
    const otherIn = m?.otherInCents ?? 0;
    const cashOut = m?.cashOutCents ?? 0;
    const expected = cs.reduce((a, c) => a + c.expectedCashCents, 0);
    const counted = cs.reduce((a, c) => a + c.countedCashCents, 0);
    const diff = cs.reduce((a, c) => a + c.differenceCents, 0);

    let status: CashDayStatus;
    if (cs.length > 0) {
      status = cs
        .map((c) => classifyDifference(c.differenceCents))
        .reduce((worst, s) => (SEVERITY[s] > SEVERITY[worst] ? s : worst), "balanced");
    } else if (d === input.todayISO) {
      status = cashIn + cashOut + otherIn > 0 ? "pending" : "idle";
    } else if (d > input.todayISO) {
      status = "idle";
    } else {
      status = cashIn + cashOut > 0 ? "unclosed" : "idle";
    }

    out.push({
      date: d,
      status,
      closures: cs.length,
      expectedCents: expected,
      countedCents: counted,
      diffCents: diff,
      cashInCents: cashIn,
      otherInCents: otherIn,
      cashOutCents: cashOut,
    });
  }
  return out;
}

export type CashSummary = {
  closedDays: number;
  unclosedDays: number;
  balancedDays: number;
  balancedPct: number | null; // null si no hubo cierres
  shortCents: number; // suma de faltantes (negativo o 0)
  overCents: number; // suma de sobrantes (positivo o 0)
  netDiffCents: number;
  balancedStreak: number; // cierres cuadrados seguidos, contando desde el más reciente
  worstDay: CashDay | null; // el faltante más grande
};

export function summarizeCashDays(days: CashDay[]): CashSummary {
  const closed = days.filter((d) => d.closures > 0);
  const balanced = closed.filter((d) => d.status === "balanced");
  let shortCents = 0;
  let overCents = 0;
  for (const d of closed) {
    if (d.diffCents < 0) shortCents += d.diffCents;
    else overCents += d.diffCents;
  }
  let streak = 0;
  for (let i = closed.length - 1; i >= 0; i--) {
    if (closed[i].status !== "balanced") break;
    streak++;
  }
  const worst = closed.reduce<CashDay | null>(
    (w, d) => (d.diffCents < 0 && (!w || d.diffCents < w.diffCents) ? d : w),
    null,
  );
  return {
    closedDays: closed.length,
    unclosedDays: days.filter((d) => d.status === "unclosed").length,
    balancedDays: balanced.length,
    balancedPct: closed.length ? Math.round((balanced.length / closed.length) * 100) : null,
    shortCents,
    overCents,
    netDiffCents: shortCents + overCents,
    balancedStreak: streak,
    worstDay: worst,
  };
}

// Frases cortas de lectura rápida, por reglas simples (sin IA). Solo devuelve las que
// aplican; la UI muestra hasta 3.
export function cashInsights(
  days: CashDay[],
  summary: CashSummary,
  methodMix: { method: string; cents: number }[],
): string[] {
  const out: string[] = [];
  if (summary.unclosedDays > 0) {
    out.push(
      `${summary.unclosedDays} ${summary.unclosedDays === 1 ? "día quedó" : "días quedaron"} sin cerrar con efectivo en caja.`,
    );
  }
  const closed = days.filter((d) => d.closures > 0);
  const lastFive = closed.slice(-5);
  const shortsInLastFive = lastFive.filter((d) => d.diffCents < -CASH_BALANCED_TOLERANCE_CENTS);
  if (lastFive.length >= 3 && shortsInLastFive.length >= 3) {
    out.push(
      `Faltante en ${shortsInLastFive.length} de los últimos ${lastFive.length} cierres: revisa el proceso de caja.`,
    );
  }
  if (summary.balancedStreak >= 5) {
    out.push(`Racha de ${summary.balancedStreak} cierres cuadrados seguidos.`);
  }
  const total = methodMix.reduce((a, m) => a + m.cents, 0);
  const cash = methodMix.find((m) => m.method === "cash")?.cents ?? 0;
  if (total > 0) {
    const pct = Math.round((cash / total) * 100);
    out.push(
      pct >= 50
        ? `El ${pct}% del dinero entra en efectivo: la caja física pesa mucho en el negocio.`
        : `Solo el ${pct}% del dinero entra en efectivo; el resto llega por medios digitales.`,
    );
  }
  return out;
}
