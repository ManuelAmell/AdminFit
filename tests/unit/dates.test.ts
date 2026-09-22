import { describe, expect, it } from "vitest";
import { currentMonthISO, previousMonthISO } from "@/lib/dates";

describe("previousMonthISO", () => {
  it("resta un mes dentro del mismo año", () => {
    expect(previousMonthISO("2026-09")).toBe("2026-08");
  });
  it("cruza el año en enero", () => {
    expect(previousMonthISO("2026-01")).toBe("2025-12");
  });
});

describe("currentMonthISO", () => {
  it("devuelve YYYY-MM", () => {
    expect(currentMonthISO()).toMatch(/^\d{4}-\d{2}$/);
  });
});
