import { describe, expect, it } from "vitest";
import { closeCashSchema } from "@/modules/cash/schema";

const base = { dateISO: "2026-09-22", openingCash: "50.000", countedCash: "320.000" };

describe("closeCashSchema", () => {
  it("acepta un cierre válido", () => {
    expect(closeCashSchema.safeParse(base).success).toBe(true);
  });

  it("acepta contado en cero (faltante total, es un dato válido)", () => {
    expect(closeCashSchema.safeParse({ ...base, countedCash: "0" }).success).toBe(true);
  });

  it("rechaza fecha con formato inválido", () => {
    expect(closeCashSchema.safeParse({ ...base, dateISO: "22/09/2026" }).success).toBe(false);
  });

  it("rechaza base vacía", () => {
    expect(closeCashSchema.safeParse({ ...base, openingCash: "" }).success).toBe(false);
  });

  it("acepta branchId nulo (org sin sedes)", () => {
    expect(closeCashSchema.safeParse({ ...base, branchId: null }).success).toBe(true);
  });
});
