import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/db";
import { expenses, organization } from "@/db/schema";
import { withTenant } from "@/lib/tenant";
import { registerPaymentCore } from "@/modules/payments/core";
import { getMonthlySummary } from "@/modules/reports/queries";

// Fase 5.7b: reporte del mes elegido por el usuario (a diferencia de las gráficas del
// dashboard, que siempre miran "los últimos N meses").
const run = Date.now().toString(36);
const org = { id: `sum-${run}`, name: "Summary Org", slug: `sum-${run}`, createdAt: new Date() };
const thisMonth = new Date().toISOString().slice(0, 7);

describe("getMonthlySummary", () => {
  beforeAll(async () => {
    await db.insert(organization).values(org);
    await withTenant(org.id, (tx) =>
      registerPaymentCore(
        tx,
        { orgId: org.id, userId: null },
        { concept: "day_pass", payerName: "A", amountCents: 15_000_00, method: "cash" },
      ),
    );
    await withTenant(org.id, (tx) =>
      registerPaymentCore(
        tx,
        { orgId: org.id, userId: null },
        { concept: "product", payerName: "B", amountCents: 10_000_00, method: "transfer" },
      ),
    );
    await withTenant(org.id, (tx) =>
      tx.insert(expenses).values([
        { orgId: org.id, category: "rent", description: "Arriendo", amountCents: 300_000_00 },
        { orgId: org.id, category: "payroll", description: "Nómina", amountCents: 500_000_00 },
      ]),
    );
  });

  afterAll(async () => {
    await db.delete(organization).where(eq(organization.id, org.id));
  });

  it("agrupa ingresos por concepto y por método, y gastos por categoría", async () => {
    const s = await getMonthlySummary(org.id, thisMonth, false);
    expect(s.incomeTotal).toBe(15_000_00 + 10_000_00);
    expect(s.incomeByConcept.find((r) => r.concept === "day_pass")?.cents).toBe(15_000_00);
    expect(s.incomeByMethod.find((r) => r.method === "transfer")?.cents).toBe(10_000_00);
    expect(s.expensesTotal).toBe(300_000_00 + 500_000_00);
    expect(s.profitCents).toBe(s.incomeTotal - s.expensesTotal);
  });

  it("excludePayroll saca la nómina del total de gastos", async () => {
    const s = await getMonthlySummary(org.id, thisMonth, true);
    expect(s.expensesByCategory.some((r) => r.category === "payroll")).toBe(false);
    expect(s.expensesTotal).toBe(300_000_00);
  });

  it("el mes anterior sin movimientos da comparación en cero, no un error", async () => {
    const s = await getMonthlySummary(org.id, thisMonth, false);
    expect(s.previous.incomeTotal).toBe(0);
    expect(s.previous.expensesTotal).toBe(0);
  });
});
