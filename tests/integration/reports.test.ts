import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/db";
import { auditLog, members, organization, payments, plans, subscriptions, user } from "@/db/schema";
import { todayISO } from "@/lib/dates";
import { withTenant } from "@/lib/tenant";
import { getTenantReport, getReportExportData } from "@/modules/reports/queries";
import { reportFiltersSchema } from "@/modules/reports/schema";

const run = Date.now().toString(36);
const orgA = {
  id: `rep-a-${run}`,
  name: "Gym Reports A",
  slug: `gym-rep-a-${run}`,
  createdAt: new Date(),
};
const orgB = {
  id: `rep-b-${run}`,
  name: "Gym Reports B",
  slug: `gym-rep-b-${run}`,
  createdAt: new Date(),
};
const cashier = {
  id: `cashier-rep-${run}`,
  name: "Cajera Reportes",
  email: `cashier-rep-${run}@test.local`,
};

let planA1: string;
let planA2: string;
let memberA1: string;
let memberA2: string;
let memberB: string;

describe("reportes del tenant: consultas y agregaciones", () => {
  beforeAll(async () => {
    await db.insert(organization).values([orgA, orgB]);
    await db.insert(user).values({ ...cashier, emailVerified: false });

    // Configurar Org A
    await withTenant(orgA.id, async (tx) => {
      const [m1] = await tx
        .insert(members)
        .values({
          orgId: orgA.id,
          documentNumber: `101${run}`,
          firstName: "Ana",
          lastName: "Atleta",
          createdAt: new Date(),
        })
        .returning({ id: members.id });
      memberA1 = m1.id;

      const [m2] = await tx
        .insert(members)
        .values({
          orgId: orgA.id,
          documentNumber: `102${run}`,
          firstName: "Bernardo",
          lastName: "Boxeador",
          createdAt: new Date(),
        })
        .returning({ id: members.id });
      memberA2 = m2.id;

      const [p1] = await tx
        .insert(plans)
        .values({ orgId: orgA.id, name: "Plan Mes Oro", priceCents: 120_000_00 })
        .returning({ id: plans.id });
      planA1 = p1.id;

      const [p2] = await tx
        .insert(plans)
        .values({ orgId: orgA.id, name: "Plan Trimestre Plata", priceCents: 300_000_00 })
        .returning({ id: plans.id });
      planA2 = p2.id;

      const [sub1] = await tx
        .insert(subscriptions)
        .values({
          orgId: orgA.id,
          memberId: memberA1,
          planId: planA1,
          startDate: todayISO(),
          endDate: todayISO(),
          status: "active",
          priceCentsSnapshot: 120_000_00,
        })
        .returning({ id: subscriptions.id });

      // Pago 1: Efectivo con membresía 1
      await tx.insert(payments).values({
        orgId: orgA.id,
        memberId: memberA1,
        subscriptionId: sub1.id,
        amountCents: 120_000_00,
        method: "cash",
        status: "completed",
        receiptNumber: 1,
        paidAt: new Date(),
      });

      // Pago 2: Transferencia sin membresía (directo / day pass)
      await tx.insert(payments).values({
        orgId: orgA.id,
        memberId: memberA2,
        subscriptionId: null,
        amountCents: 25_000_00,
        method: "transfer",
        status: "completed",
        receiptNumber: 2,
        paidAt: new Date(),
      });

      // Pago 3: Pago anulado (no debe sumarse)
      await tx.insert(payments).values({
        orgId: orgA.id,
        memberId: memberA1,
        subscriptionId: sub1.id,
        amountCents: 50_000_00,
        method: "card",
        status: "voided",
        receiptNumber: 3,
        paidAt: new Date(),
      });

      // Registrar una renovación en audit_log
      await tx.insert(auditLog).values({
        orgId: orgA.id,
        actorId: cashier.id,
        action: "subscription.renew",
        entity: "subscription",
        entityId: sub1.id,
        createdAt: new Date(),
      });
    });

    // Configurar Org B (para probar aislamiento)
    await withTenant(orgB.id, async (tx) => {
      const [mb] = await tx
        .insert(members)
        .values({
          orgId: orgB.id,
          documentNumber: `201${run}`,
          firstName: "Carlos",
          lastName: "Competidor",
        })
        .returning({ id: members.id });
      memberB = mb.id;

      await tx.insert(payments).values({
        orgId: orgB.id,
        memberId: memberB,
        amountCents: 999_000_00,
        method: "cash",
        status: "completed",
        receiptNumber: 1,
        paidAt: new Date(),
      });
    });
  });

  afterAll(async () => {
    await withTenant(orgA.id, async (tx) => {
      await tx.delete(auditLog);
      await tx.delete(payments);
      await tx.delete(subscriptions);
      await tx.delete(plans);
      await tx.delete(members);
    });
    await withTenant(orgB.id, async (tx) => {
      await tx.delete(payments);
      await tx.delete(members);
    });
    await db.delete(user);
    await db.delete(organization);
  });

  it("calcula ingresos por plan y por método aislando por tenant", async () => {
    const filters = reportFiltersSchema.parse({ range: "today" });
    const report = await getTenantReport(orgA.id, filters);

    // Total recaudado debe ser 120.000 + 25.000 = 145.000 pesos = 14.500.000 centavos
    // (excluyendo el pago anulado de 50.000 y los 999.000 de Org B)
    expect(report.summary.totalRevenueCents).toBe(14_500_000);
    expect(report.summary.totalPayments).toBe(2);

    // Desglose por método
    const cash = report.byMethod.find((m) => m.method === "cash");
    const transfer = report.byMethod.find((m) => m.method === "transfer");
    expect(cash?.totalCents).toBe(12_000_000);
    expect(transfer?.totalCents).toBe(2_500_000);

    // Desglose por plan
    const goldPlan = report.byPlan.find((p) => p.planName === "Plan Mes Oro");
    const directSale = report.byPlan.find((p) => p.planId === "unassigned");
    expect(goldPlan?.totalCents).toBe(12_000_000);
    expect(directSale?.totalCents).toBe(2_500_000);

    // Métricas de socios y renovaciones
    expect(report.summary.newMembersCount).toBe(2);
    expect(report.summary.renewalsCount).toBe(1);
    expect(report.summary.expirationsCount).toBe(1);
  });

  it("obtiene la estructura para exportar CSV correctamente", async () => {
    const filters = reportFiltersSchema.parse({ range: "today" });
    const exportData = await getReportExportData(orgA.id, filters);

    expect(exportData.orgName).toBe("Gym Reports A");
    expect(exportData.paymentsDetail.length).toBe(2);
    expect(exportData.paymentsDetail.some((p) => p.memberName === "Ana Atleta")).toBe(true);
  });
});
