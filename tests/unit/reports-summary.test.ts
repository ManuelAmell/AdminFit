import { describe, expect, it } from "vitest";
import { computePercentages } from "@/modules/reports/queries";

describe("computePercentages", () => {
  it("calcula porcentajes correctos con base en total recaudado", () => {
    const items = [{ totalCents: 6000000 }, { totalCents: 4000000 }];
    const withPercentages = computePercentages(items, 10000000);
    expect(withPercentages[0].percentage).toBe(60);
    expect(withPercentages[1].percentage).toBe(40);
  });

  it("asigna 0% cuando el total es 0 para evitar división por cero", () => {
    const items = [{ totalCents: 0 }];
    const withPercentages = computePercentages(items, 0);
    expect(withPercentages[0].percentage).toBe(0);
  });
});
