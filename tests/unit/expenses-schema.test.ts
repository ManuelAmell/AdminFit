import { describe, expect, it } from "vitest";
import { createExpenseSchema, voidExpenseSchema } from "@/modules/expenses/schema";

describe("createExpenseSchema", () => {
  const base = {
    category: "supplies" as const,
    description: "Papel higiénico",
    amount: "25.000",
    method: "cash" as const,
  };

  it("acepta un gasto válido", () => {
    expect(createExpenseSchema.safeParse(base).success).toBe(true);
  });

  it("rechaza sin descripción", () => {
    expect(createExpenseSchema.safeParse({ ...base, description: "" }).success).toBe(false);
  });

  it("rechaza monto en cero", () => {
    expect(createExpenseSchema.safeParse({ ...base, amount: "0" }).success).toBe(false);
  });

  it("acepta la categoría nómina (el permiso se valida en la action, no aquí)", () => {
    expect(createExpenseSchema.safeParse({ ...base, category: "payroll" }).success).toBe(true);
  });
});

describe("voidExpenseSchema", () => {
  it("exige un motivo de al menos 5 caracteres", () => {
    const r = voidExpenseSchema.safeParse({ expenseId: crypto.randomUUID(), reason: "abc" });
    expect(r.success).toBe(false);
  });
  it("acepta un motivo válido", () => {
    const r = voidExpenseSchema.safeParse({
      expenseId: crypto.randomUUID(),
      reason: "Monto duplicado",
    });
    expect(r.success).toBe(true);
  });
});
