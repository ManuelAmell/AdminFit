import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/db";
import { expenses, members, organization, plans, subscriptions } from "@/db/schema";
import { withTenant } from "@/lib/tenant";
import { registerPaymentCore } from "@/modules/payments/core";
import {
  getDashboardKpis,
  getExpenseBreakdown,
  getIncomeVsExpenses,
  getPlanPerformance,
  getRevenueSeries,
} from "@/modules/reports/queries";

// Fase 5.7: dashboards con gráficas. Se prueba la aritmética de cada query (no el render —
// eso es UI), incluida la nómina oculta cuando excludePayroll = true.
const run = Date.now().toString(36);
const org = { id: `rep-${run}`, name: "Reports Org", slug: `rep-${run}`, createdAt: new Date() };

describe("reportes: series y agregados del dashboard", () => {
  let planId: string;
  let memberId: string;

  beforeAll(async () => {
    await db.insert(organization).values(org);
    await withTenant(org.id, async (tx) => {
      const [p] = await tx
        .insert(plans)
        .values({ orgId: org.id, name: "Mensual", priceCents: 100_000_00 })
        .returning({ id: plans.id });
      planId = p.id;
      const [m] = await tx
        .insert(members)
        .values({ orgId: org.id, documentNumber: `1${run}`, firstName: "Rep", lastName: "Orte" })
        .returning({ id: members.id });
      memberId = m.id;
      await tx.insert(subscriptions).values({
        orgId: org.id,
        memberId: m.id,
        planId: p.id,
        startDate: "2026-09-01",
        endDate: "2026-10-01",
        priceCentsSnapshot: 100_000_00,
      });
    });

    const [sub] = await withTenant(org.id, (tx) =>
      tx
        .select({ id: subscriptions.id })
        .from(subscriptions)
        .where(eq(subscriptions.memberId, memberId)),
    );

    // Un pago ligado a la membresía (cuenta para planPerformance) y una venta rápida sin
    // socio (cuenta para el ingreso total, pero no tiene plan).
    await withTenant(org.id, (tx) =>
      registerPaymentCore(
        tx,
        { orgId: org.id, userId: null },
        { memberId, subscriptionId: sub.id, amountCents: 100_000_00, method: "cash" },
      ),
    );
    await withTenant(org.id, (tx) =>
      registerPaymentCore(
        tx,
        { orgId: org.id, userId: null },
        { concept: "day_pass", payerName: "Visitante", amountCents: 15_000_00, method: "cash" },
      ),
    );

    await withTenant(org.id, (tx) =>
      tx.insert(expenses).values([
        { orgId: org.id, category: "rent", description: "Arriendo", amountCents: 400_000_00 },
        { orgId: org.id, category: "payroll", description: "Nómina", amountCents: 900_000_00 },
      ]),
    );
  });

  afterAll(async () => {
    await db.delete(organization).where(eq(organization.id, org.id));
  });

  it("getRevenueSeries incluye hoy y suma los pagos completados del día", async () => {
    const series = await getRevenueSeries(org.id, 14);
    expect(series).toHaveLength(14);
    const todayPoint = series.at(-1)!;
    expect(todayPoint.cents).toBe(100_000_00 + 15_000_00);
  });

  it("getIncomeVsExpenses agrupa el mes actual con ingresos y gastos completados", async () => {
    const months = await getIncomeVsExpenses(org.id, 6);
    expect(months).toHaveLength(6);
    const current = months.at(-1)!;
    expect(current.incomeCents).toBe(100_000_00 + 15_000_00);
    expect(current.expenseCents).toBe(400_000_00 + 900_000_00);
  });

  it("getExpenseBreakdown excluye nómina cuando excludePayroll es true", async () => {
    const withPayroll = await getExpenseBreakdown(org.id, { range: "month" }, false);
    expect(withPayroll.find((e) => e.category === "payroll")?.cents).toBe(900_000_00);

    const withoutPayroll = await getExpenseBreakdown(org.id, { range: "month" }, true);
    expect(withoutPayroll.some((e) => e.category === "payroll")).toBe(false);
    expect(withoutPayroll.find((e) => e.category === "rent")?.cents).toBe(400_000_00);
  });

  it("getPlanPerformance solo cuenta pagos ligados a una membresía", async () => {
    const perf = await getPlanPerformance(org.id, { range: "month" });
    expect(perf).toHaveLength(1);
    expect(perf[0]?.planId).toBe(planId);
    expect(perf[0]?.cents).toBe(100_000_00);
    expect(perf[0]?.n).toBe(1);
  });

  it("getDashboardKpis calcula la utilidad como ingresos - gastos del mes", async () => {
    const kpis = await getDashboardKpis(org.id);
    expect(kpis.revenueCentsThisMonth).toBe(100_000_00 + 15_000_00);
    expect(kpis.expenseCentsThisMonth).toBe(400_000_00 + 900_000_00);
    expect(kpis.profitCentsThisMonth).toBe(kpis.revenueCentsThisMonth - kpis.expenseCentsThisMonth);
  });
});
