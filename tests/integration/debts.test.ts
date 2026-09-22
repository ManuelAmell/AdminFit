import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/db";
import { members, organization, plans, subscriptions } from "@/db/schema";
import { withTenant } from "@/lib/tenant";
import { registerPaymentCore } from "@/modules/payments/core";
import { getDebtorsCount, getTotalDebtCents, listDebtors } from "@/modules/payments/queries";

// Fase 5.5: cartera — un query agregado (no N+1) sobre saldo pendiente por suscripción.
const run = Date.now().toString(36);
const org = { id: `debt-${run}`, name: "Debt Org", slug: `debt-${run}`, createdAt: new Date() };

let planId: string;
let memberDebtor: string;
let subDebtor: string;
let subPaid: string;
let subCancelled: string;

describe("cartera: saldos pendientes", () => {
  beforeAll(async () => {
    await db.insert(organization).values(org);
    await withTenant(org.id, async (tx) => {
      const [p] = await tx
        .insert(plans)
        .values({ orgId: org.id, name: "Mensual", priceCents: 100_000_00 })
        .returning({ id: plans.id });
      planId = p.id;

      const [mDebtor] = await tx
        .insert(members)
        .values({ orgId: org.id, documentNumber: `1${run}`, firstName: "Deuda", lastName: "Uno" })
        .returning({ id: members.id });
      memberDebtor = mDebtor.id;
      const [sDebtor] = await tx
        .insert(subscriptions)
        .values({
          orgId: org.id,
          memberId: memberDebtor,
          planId,
          startDate: "2026-09-01",
          endDate: "2026-10-01",
          priceCentsSnapshot: 100_000_00,
        })
        .returning({ id: subscriptions.id });
      subDebtor = sDebtor.id;

      const [mPaid] = await tx
        .insert(members)
        .values({ orgId: org.id, documentNumber: `2${run}`, firstName: "Al", lastName: "Dia" })
        .returning({ id: members.id });
      const [sPaid] = await tx
        .insert(subscriptions)
        .values({
          orgId: org.id,
          memberId: mPaid.id,
          planId,
          startDate: "2026-09-01",
          endDate: "2026-10-01",
          priceCentsSnapshot: 100_000_00,
        })
        .returning({ id: subscriptions.id });
      subPaid = sPaid.id;

      const [mCancelled] = await tx
        .insert(members)
        .values({ orgId: org.id, documentNumber: `3${run}`, firstName: "Cancel", lastName: "Ada" })
        .returning({ id: members.id });
      const [sCancelled] = await tx
        .insert(subscriptions)
        .values({
          orgId: org.id,
          memberId: mCancelled.id,
          planId,
          startDate: "2026-09-01",
          endDate: "2026-10-01",
          priceCentsSnapshot: 100_000_00,
          status: "cancelled",
        })
        .returning({ id: subscriptions.id });
      subCancelled = sCancelled.id;
    });

    // sDebtor: abona 30.000 de 100.000 → debe 70.000.
    await withTenant(org.id, (tx) =>
      registerPaymentCore(
        tx,
        { orgId: org.id, userId: null },
        {
          memberId: memberDebtor,
          subscriptionId: subDebtor,
          amountCents: 30_000_00,
          method: "cash",
        },
      ),
    );
    // sPaid: paga completo → no aparece en cartera.
    const [mPaidRow] = await withTenant(org.id, (tx) =>
      tx
        .select({ id: subscriptions.memberId })
        .from(subscriptions)
        .where(eq(subscriptions.id, subPaid)),
    );
    await withTenant(org.id, (tx) =>
      registerPaymentCore(
        tx,
        { orgId: org.id, userId: null },
        { memberId: mPaidRow.id, subscriptionId: subPaid, amountCents: 100_000_00, method: "cash" },
      ),
    );
    // sCancelled: nunca se pagó, pero está cancelada → no cuenta como deuda por cobrar.
  });

  afterAll(async () => {
    await db.delete(organization).where(eq(organization.id, org.id));
  });

  it("solo lista la suscripción con saldo pendiente, no la pagada ni la cancelada", async () => {
    const debtors = await listDebtors(org.id);
    expect(debtors).toHaveLength(1);
    expect(debtors[0]?.subscriptionId).toBe(subDebtor);
    expect(debtors[0]?.balanceCents).toBe(70_000_00);
    expect(debtors[0]?.paidCents).toBe(30_000_00);
    expect(debtors.some((d) => d.subscriptionId === subCancelled)).toBe(false);
  });

  it("getTotalDebtCents suma solo lo pendiente", async () => {
    expect(await getTotalDebtCents(org.id)).toBe(70_000_00);
  });

  it("getDebtorsCount cuenta las suscripciones con saldo", async () => {
    expect(await getDebtorsCount(org.id)).toBe(1);
  });

  it("un pago adicional que salda la deuda la saca de la cartera", async () => {
    await withTenant(org.id, (tx) =>
      registerPaymentCore(
        tx,
        { orgId: org.id, userId: null },
        {
          memberId: memberDebtor,
          subscriptionId: subDebtor,
          amountCents: 70_000_00,
          method: "cash",
        },
      ),
    );
    expect(await getDebtorsCount(org.id)).toBe(0);
    expect(await getTotalDebtCents(org.id)).toBe(0);
  });
});
