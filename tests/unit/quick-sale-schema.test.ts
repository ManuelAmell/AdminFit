import { describe, expect, it } from "vitest";
import { quickSaleSchema } from "@/modules/payments/schema";
import { generalSettingsSchema } from "@/modules/settings/schema";

const base = { concept: "day_pass" as const, amount: "15.000", method: "cash" as const };

describe("quickSaleSchema", () => {
  it("acepta con socio y sin payerName", () => {
    const r = quickSaleSchema.safeParse({ ...base, memberId: crypto.randomUUID() });
    expect(r.success).toBe(true);
  });

  it("acepta sin socio si hay payerName", () => {
    const r = quickSaleSchema.safeParse({ ...base, payerName: "Visitante" });
    expect(r.success).toBe(true);
  });

  it("rechaza sin socio y sin payerName", () => {
    const r = quickSaleSchema.safeParse(base);
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0]?.path).toContain("payerName");
  });

  it("exige referencia para transferencia/tarjeta", () => {
    const r = quickSaleSchema.safeParse({ ...base, payerName: "X", method: "transfer" });
    expect(r.success).toBe(false);
  });

  it("rechaza monto en cero", () => {
    const r = quickSaleSchema.safeParse({ ...base, amount: "0", payerName: "X" });
    expect(r.success).toBe(false);
  });
});

describe("generalSettingsSchema", () => {
  it("acepta vacío (sin precio fijo)", () => {
    expect(generalSettingsSchema.safeParse({ dayPassPrice: "" }).success).toBe(true);
  });
  it("acepta un monto válido", () => {
    expect(generalSettingsSchema.safeParse({ dayPassPrice: "15.000" }).success).toBe(true);
  });
  it("rechaza cero", () => {
    expect(generalSettingsSchema.safeParse({ dayPassPrice: "0" }).success).toBe(false);
  });
});
