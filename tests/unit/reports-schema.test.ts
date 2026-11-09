import { describe, expect, it } from "vitest";
import {
  REPORT_PRESETS,
  reportFiltersSchema,
  resolveReportDateRange,
} from "@/modules/reports/schema";

describe("reportFiltersSchema", () => {
  it("asigna valores por defecto (range: month)", () => {
    const parsed = reportFiltersSchema.parse({});
    expect(parsed.range).toBe("month");
    expect(parsed.from).toBeUndefined();
    expect(parsed.to).toBeUndefined();
  });

  it("acepta todos los presets válidos", () => {
    for (const preset of REPORT_PRESETS) {
      const parsed = reportFiltersSchema.parse({ range: preset });
      expect(parsed.range).toBe(preset);
    }
  });

  it("normaliza rango personalizado con fechas YYYY-MM-DD", () => {
    const parsed = reportFiltersSchema.parse({
      range: "custom",
      from: "2026-03-01",
      to: "2026-03-15",
    });
    expect(parsed.range).toBe("custom");
    expect(parsed.from).toBe("2026-03-01");
    expect(parsed.to).toBe("2026-03-15");
  });

  it("ignora fechas mal formateadas o las descarta en validación", () => {
    const parsed = reportFiltersSchema.safeParse({
      range: "custom",
      from: "invalid-date",
      to: "2026-03-15",
    });
    expect(parsed.success).toBe(false);
  });

  it("falla si from es posterior a to en custom", () => {
    const parsed = reportFiltersSchema.safeParse({
      range: "custom",
      from: "2026-03-20",
      to: "2026-03-10",
    });
    expect(parsed.success).toBe(false);
  });
});

describe("resolveReportDateRange (TZ Bogotá)", () => {
  it("calcula inicio y fin de mes para range: month", () => {
    const { from, to, fromISO, toISO } = resolveReportDateRange({ range: "month" });
    expect(fromISO).toMatch(/^\d{4}-\d{2}-01$/);
    expect(toISO).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(from.getTime()).toBeLessThan(to.getTime());
  });

  it("calcula rango custom respetando fechas ISO especificadas", () => {
    const { fromISO, toISO } = resolveReportDateRange({
      range: "custom",
      from: "2026-05-10",
      to: "2026-05-20",
    });
    expect(fromISO).toBe("2026-05-10");
    expect(toISO).toBe("2026-05-20");
  });

  it("custom no se corre de día aunque el proceso corra en UTC (servidor/Docker)", () => {
    const original = process.env.TZ;
    process.env.TZ = "UTC";
    try {
      const { from, to, fromISO, toISO } = resolveReportDateRange({
        range: "custom",
        from: "2026-11-01",
        to: "2026-11-05",
      });
      expect(fromISO).toBe("2026-11-01");
      expect(toISO).toBe("2026-11-05");
      // Medianoche de Bogotá (UTC-5) = 05:00Z
      expect(from.getTime()).toBe(Date.parse("2026-11-01T05:00:00.000Z"));
      expect(to.getTime()).toBe(Date.parse("2026-11-06T04:59:59.999Z"));
    } finally {
      if (original === undefined) delete process.env.TZ;
      else process.env.TZ = original;
    }
  });

  it("calcula hoy (today) cubriendo desde inicio hasta fin del día", () => {
    const { fromISO, toISO, from, to } = resolveReportDateRange({ range: "today" });
    expect(fromISO).toBe(toISO);
    expect(to.getTime() - from.getTime()).toBeGreaterThanOrEqual(86400000 - 1000);
  });
});
