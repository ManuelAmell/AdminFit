import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/db";
import { expenses, organization, user } from "@/db/schema";
import { withTenant } from "@/lib/tenant";
import { expenseFiltersSchema } from "@/modules/expenses/schema";
import { listExpenses } from "@/modules/expenses/queries";

// Fase 5.4: gastos por sede/categoría, con scope por usuario (Recepción) y nómina oculta
// sin expense.readPayroll — ver Fase 5 slice 0 (matriz de permisos).
const run = Date.now().toString(36);
const org = { id: `exp-${run}`, name: "Expenses Org", slug: `exp-${run}`, createdAt: new Date() };
const org2 = { id: `exp2-${run}`, name: "Other Org", slug: `exp2-${run}`, createdAt: new Date() };
const staffUser = {
  id: `exp-staff-${run}`,
  name: "Recepción Test",
  email: `exp-staff-${run}@test.local`,
};
const adminUser = {
  id: `exp-admin-${run}`,
  name: "Admin Test",
  email: `exp-admin-${run}@test.local`,
};

async function insertExpense(orgId: string, values: Partial<typeof expenses.$inferInsert>) {
  return withTenant(orgId, async (tx) => {
    const [row] = await tx
      .insert(expenses)
      .values({
        orgId,
        category: "supplies",
        description: "Gasto de prueba",
        amountCents: 10_000_00,
        method: "cash",
        ...values,
      })
      .returning({ id: expenses.id });
    return row.id;
  });
}

describe("gastos: scope por usuario, nómina y aislamiento", () => {
  beforeAll(async () => {
    await db.insert(organization).values([org, org2]);
    await db.insert(user).values([
      { ...staffUser, emailVerified: false },
      { ...adminUser, emailVerified: false },
    ]);
    await insertExpense(org.id, {
      description: "Arriendo",
      category: "rent",
      recordedBy: adminUser.id,
    });
    await insertExpense(org.id, {
      description: "Nómina recepción",
      category: "payroll",
      amountCents: 900_000_00,
      recordedBy: adminUser.id,
    });
    await insertExpense(org.id, {
      description: "Caja menor del turno",
      category: "supplies",
      amountCents: 5_000_00,
      recordedBy: staffUser.id,
    });
    await insertExpense(org2.id, { description: "Otra org", recordedBy: adminUser.id });
  });

  afterAll(async () => {
    await db.delete(organization).where(eq(organization.id, org.id));
    await db.delete(organization).where(eq(organization.id, org2.id));
    await db.delete(user).where(eq(user.id, staffUser.id));
    await db.delete(user).where(eq(user.id, adminUser.id));
  });

  it("owner/admin ven todos los gastos de la org, incluida nómina", async () => {
    const result = await listExpenses(org.id, expenseFiltersSchema.parse({ range: "all" }), {});
    expect(result.total).toBe(3);
    expect(result.rows.some((r) => r.category === "payroll")).toBe(true);
  });

  it("sin expense.readAll, Recepción solo ve sus propios gastos", async () => {
    const result = await listExpenses(org.id, expenseFiltersSchema.parse({ range: "all" }), {
      recordedBy: staffUser.id,
    });
    expect(result.total).toBe(1);
    expect(result.rows[0]?.description).toBe("Caja menor del turno");
  });

  it("sin expense.readPayroll, la nómina no sale ni en la lista ni en el total", async () => {
    const result = await listExpenses(org.id, expenseFiltersSchema.parse({ range: "all" }), {
      excludePayroll: true,
    });
    expect(result.total).toBe(2);
    expect(result.rows.some((r) => r.category === "payroll")).toBe(false);
    expect(result.completedTotal).toBe(10_000_00 + 5_000_00);
  });

  it("un tenant no ve los gastos de otro", async () => {
    const result = await listExpenses(org2.id, expenseFiltersSchema.parse({ range: "all" }), {});
    expect(result.total).toBe(1);
    expect(result.rows[0]?.description).toBe("Otra org");
  });

  it("anular no borra y deja de contar en el total", async () => {
    const [target] = await withTenant(org.id, (tx) =>
      tx.select({ id: expenses.id }).from(expenses).where(eq(expenses.description, "Arriendo")),
    );
    await withTenant(org.id, (tx) =>
      tx
        .update(expenses)
        .set({ status: "voided", voidedAt: new Date(), voidedBy: adminUser.id, voidReason: "test" })
        .where(eq(expenses.id, target.id)),
    );
    const result = await listExpenses(org.id, expenseFiltersSchema.parse({ range: "all" }), {});
    expect(result.total).toBe(3);
    expect(result.completedTotal).toBe(900_000_00 + 5_000_00);
  });
});
