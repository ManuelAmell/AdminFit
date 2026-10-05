import { describe, expect, it } from "vitest";
import {
  buildCashDays,
  cashInsights,
  classifyDifference,
  parseCashRange,
  resolveCashRange,
  summarizeCashDays,
  type ClosureLite,
} from "@/modules/cash/analytics";
import { formatCOPShort } from "@/lib/money";

const closure = (businessDate: string, differenceCents: number): ClosureLite => ({
  businessDate,
  expectedCashCents: 100_000_00,
  countedCashCents: 100_000_00 + differenceCents,
  differenceCents,
});

describe("classifyDifference", () => {
  it("cuadrado dentro de la tolerancia, en ambos sentidos", () => {
    expect(classifyDifference(0)).toBe("balanced");
    expect(classifyDifference(-1_000_00)).toBe("balanced");
    expect(classifyDifference(1_000_00)).toBe("balanced");
  });
  it("menor hasta el umbral; faltante/sobrante por encima", () => {
    expect(classifyDifference(-5_000_00)).toBe("minor");
    expect(classifyDifference(-50_000_00)).toBe("short");
    expect(classifyDifference(50_000_00)).toBe("over");
  });
});

describe("resolveCashRange / parseCashRange", () => {
  it("N días incluye hoy", () => {
    expect(resolveCashRange("7", "2026-09-24")).toEqual({
      fromISO: "2026-09-18",
      toISO: "2026-09-24",
    });
  });
  it("este mes arranca el día 1", () => {
    expect(resolveCashRange("month", "2026-09-24").fromISO).toBe("2026-09-01");
  });
  it("un valor desconocido cae en 30 días", () => {
    expect(parseCashRange("999")).toBe("30");
    expect(parseCashRange(undefined)).toBe("30");
  });
});

describe("buildCashDays", () => {
  const base = { fromISO: "2026-09-20", toISO: "2026-09-24", todayISO: "2026-09-24" };

  it("rellena todos los días y clasifica por estado", () => {
    const days = buildCashDays({
      ...base,
      closures: [closure("2026-09-20", 0), closure("2026-09-22", -50_000_00)],
      movements: [
        { date: "2026-09-21", cashInCents: 10_000_00, otherInCents: 0, cashOutCents: 0 },
        { date: "2026-09-24", cashInCents: 5_000_00, otherInCents: 0, cashOutCents: 0 },
      ],
    });
    expect(days.map((d) => d.status)).toEqual([
      "balanced", // 20: cerrado sin diferencia
      "unclosed", // 21: hubo efectivo, nadie cerró
      "short", // 22: faltante serio
      "idle", // 23: nada
      "pending", // 24: hoy, con movimiento y sin cierre
    ]);
  });

  it("un día que solo tuvo cobros digitales no queda 'sin cerrar'", () => {
    const [day] = buildCashDays({
      ...base,
      toISO: "2026-09-20",
      closures: [],
      movements: [{ date: "2026-09-20", cashInCents: 0, otherInCents: 90_000_00, cashOutCents: 0 }],
    });
    expect(day.status).toBe("idle");
  });

  it("con varias sedes el día toma el peor cierre y suma diferencias", () => {
    const [day] = buildCashDays({
      ...base,
      toISO: "2026-09-20",
      closures: [closure("2026-09-20", 0), closure("2026-09-20", -30_000_00)],
      movements: [],
    });
    expect(day.status).toBe("short");
    expect(day.diffCents).toBe(-30_000_00);
    expect(day.closures).toBe(2);
  });
});

describe("summarizeCashDays", () => {
  it("separa faltantes y sobrantes, calcula racha y peor día", () => {
    const days = buildCashDays({
      fromISO: "2026-09-18",
      toISO: "2026-09-22",
      todayISO: "2026-09-24",
      closures: [
        closure("2026-09-18", -40_000_00),
        closure("2026-09-19", 25_000_00),
        closure("2026-09-20", 0),
        closure("2026-09-21", 500_00),
        closure("2026-09-22", 0),
      ],
      movements: [],
    });
    const s = summarizeCashDays(days);
    expect(s.closedDays).toBe(5);
    expect(s.balancedDays).toBe(3);
    expect(s.balancedPct).toBe(60);
    expect(s.shortCents).toBe(-40_000_00);
    expect(s.overCents).toBe(25_500_00);
    expect(s.balancedStreak).toBe(3);
    expect(s.worstDay?.date).toBe("2026-09-18");
  });

  it("sin cierres el porcentaje es null", () => {
    expect(summarizeCashDays([]).balancedPct).toBeNull();
  });
});

describe("cashInsights", () => {
  it("alerta faltantes repetidos y días sin cerrar", () => {
    const days = buildCashDays({
      fromISO: "2026-09-18",
      toISO: "2026-09-22",
      todayISO: "2026-09-24",
      closures: [
        closure("2026-09-18", -5_000_00),
        closure("2026-09-19", -5_000_00),
        closure("2026-09-20", -5_000_00),
      ],
      movements: [{ date: "2026-09-21", cashInCents: 1_000_00, otherInCents: 0, cashOutCents: 0 }],
    });
    const out = cashInsights(days, summarizeCashDays(days), [
      { method: "cash", cents: 30 },
      { method: "transfer", cents: 70 },
    ]);
    expect(out[0]).toMatch(/1 día quedó sin cerrar/);
    expect(out.some((t) => /Faltante en 3 de los últimos 3/.test(t))).toBe(true);
    expect(out.some((t) => /Solo el 30%/.test(t))).toBe(true);
  });
});

describe("formatCOPShort", () => {
  it("abrevia miles y millones", () => {
    expect(formatCOPShort(900_00)).toBe("$900");
    expect(formatCOPShort(350_000_00)).toBe("$350 mil");
    expect(formatCOPShort(1_250_000_00)).toBe("$1,3 M");
    expect(formatCOPShort(-12_000_000_00)).toBe("-$12 M");
  });
});
