import { describe, expect, it } from "vitest";
import {
  canFreeze,
  computeEndDate,
  deriveStatus,
  extendedEndDateAfterFreeze,
  renewalStartDate,
} from "@/modules/subscriptions/rules";

const base = { status: "active" as const, startDate: "2026-01-01", endDate: "2026-01-31" };

describe("computeEndDate", () => {
  it("mensual desde fin de mes ajusta al último día", () => {
    expect(computeEndDate("2026-01-31", "months", 1)).toBe("2026-02-28");
  });
  it("por días suma días exactos", () => {
    expect(computeEndDate("2026-03-01", "days", 30)).toBe("2026-03-31");
  });
  it("anual", () => {
    expect(computeEndDate("2026-02-15", "months", 12)).toBe("2027-02-15");
  });
});

describe("deriveStatus", () => {
  it("al día con más de 5 días restantes", () => {
    expect(deriveStatus(base, 3, "2026-01-10")).toBe("al_dia");
  });
  it("por vencer cuando faltan 5 días o menos (incluido el mismo día)", () => {
    expect(deriveStatus(base, 3, "2026-01-26")).toBe("por_vencer");
    expect(deriveStatus(base, 3, "2026-01-31")).toBe("por_vencer");
  });
  it("en gracia dentro de graceDays tras vencer", () => {
    expect(deriveStatus(base, 3, "2026-02-01")).toBe("en_gracia");
    expect(deriveStatus(base, 3, "2026-02-03")).toBe("en_gracia");
  });
  it("vencida después de la gracia", () => {
    expect(deriveStatus(base, 3, "2026-02-04")).toBe("vencido");
    expect(deriveStatus(base, 0, "2026-02-01")).toBe("vencido");
  });
  it("congelada y cancelada priman sobre las fechas", () => {
    expect(deriveStatus({ ...base, status: "frozen" }, 3, "2026-01-10")).toBe("congelado");
    expect(deriveStatus({ ...base, status: "cancelled" }, 3, "2026-01-10")).toBe("cancelado");
  });
});

describe("renewalStartDate", () => {
  it("encadena al día siguiente del fin si aún está vigente", () => {
    expect(renewalStartDate("2026-01-31", "2026-01-20")).toBe("2026-02-01");
    expect(renewalStartDate("2026-01-31", "2026-01-31")).toBe("2026-02-01");
  });
  it("empieza hoy si ya venció o no hay membresía previa", () => {
    expect(renewalStartDate("2026-01-31", "2026-02-10")).toBe("2026-02-10");
    expect(renewalStartDate(null, "2026-02-10")).toBe("2026-02-10");
  });
});

describe("congelación", () => {
  it("extiende la fecha fin por los días congelados", () => {
    expect(extendedEndDateAfterFreeze("2026-01-31", "2026-01-10", "2026-01-17")).toBe("2026-02-07");
  });
  it("no resta si se descongela el mismo día", () => {
    expect(extendedEndDateAfterFreeze("2026-01-31", "2026-01-10", "2026-01-10")).toBe("2026-01-31");
  });
  it("solo se puede congelar una activa vigente", () => {
    expect(canFreeze(base, "2026-01-10")).toBe(true);
    expect(canFreeze(base, "2026-02-10")).toBe(false);
    expect(canFreeze({ ...base, status: "frozen" }, "2026-01-10")).toBe(false);
  });
});
