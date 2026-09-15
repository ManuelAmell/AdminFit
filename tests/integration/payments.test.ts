import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/db";
import {
  members,
  orgSettings,
  organization,
  payments,
  plans,
  subscriptions,
  user,
} from "@/db/schema";
import { withTenant } from "@/lib/tenant";
import { registerPaymentCore } from "@/modules/payments/core";
import { getCashClose, getSubscriptionBalance, listPayments } from "@/modules/payments/queries";
import { paymentFiltersSchema } from "@/modules/payments/schema";

const run = Date.now().toString(36);
const orgA = { id: `pay-a-${run}`, name: "Pay A", slug: `pay-a-${run}`, createdAt: new Date() };
const orgB = { id: `pay-b-${run}`, name: "Pay B", slug: `pay-b-${run}`, createdAt: new Date() };
const cashier = { id: `cashier-${run}`, name: "Cajera Test", email: `cashier-${run}@test.local` };

let memberA: string;
let memberB: string;
let subA: string;

describe("pagos: numeración, saldos, anulación y aislamiento", () => {
  beforeAll(async () => {
    await db.insert(organization).values([orgA, orgB]);
    await db.insert(user).values({ ...cashier, emailVerified: false });

    memberA = await withTenant(orgA.id, async (tx) => {
      const [m] = await tx
        .insert(members)
        .values({ orgId: orgA.id, documentNumber: `1${run}`, firstName: "Ana", lastName: "Pagos" })
        .returning({ id: members.id });
      const [p] = await tx
        .insert(plans)
        .values({ orgId: orgA.id, name: "Mensual", priceCents: 100_000_00 })
        .returning({ id: plans.id });
      const [s] = await tx
        .insert(subscriptions)
        .values({
          orgId: orgA.id,
          memberId: m.id,
          planId: p.id,
          startDate: "2026-09-01",
          endDate: "2026-10-01",
          priceCentsSnapshot: 100_000_00,
        })
        .returning({ id: subscriptions.id });
      subA = s.id;
      return m.id;
    });

    memberB = await withTenant(orgB.id, async (tx) => {
      const [m] = await tx
        .insert(members)
        .values({ orgId: orgB.id, documentNumber: `2${run}`, firstName: "Beto", lastName: "Otro" })
        .returning({ id: members.id });
      return m.id;
    });
  });

  afterAll(async () => {
    await db.delete(organization).where(eq(organization.id, orgA.id));
    await db.delete(organization).where(eq(organization.id, orgB.id));
    await db.delete(user).where(eq(user.id, cashier.id));
  });

  it("asigna números de recibo secuenciales sin huecos bajo concurrencia", async () => {
    const results = await Promise.all(
      Array.from({ length: 10 }, (_, i) =>
        withTenant(orgA.id, (tx) =>
          registerPaymentCore(
            tx,
            { orgId: orgA.id, userId: cashier.id },
            { memberId: memberA, subscriptionId: subA, amountCents: 5_000_00 + i, method: "cash" },
          ),
        ),
      ),
    );
    const numbers = results.map((r) => r.receiptNumber).sort((a, b) => a - b);
    expect(numbers).toEqual(Array.from({ length: 10 }, (_, i) => i + 1));

    const [settings] = await withTenant(orgA.id, (tx) =>
      tx.select().from(orgSettings).where(eq(orgSettings.orgId, orgA.id)),
    );
    expect(settings.nextReceiptNumber).toBe(11);
  });

  it("calcula el saldo pendiente con pagos parciales", async () => {
    const before = await getSubscriptionBalance(orgA.id, subA);
    const paidSoFar = Array.from({ length: 10 }, (_, i) => 5_000_00 + i).reduce((a, b) => a + b, 0);
    expect(before).toEqual({
      priceCents: 100_000_00,
      paidCents: paidSoFar,
      balanceCents: 100_000_00 - paidSoFar,
    });

    await withTenant(orgA.id, (tx) =>
      registerPaymentCore(
        tx,
        { orgId: orgA.id, userId: cashier.id },
        {
          memberId: memberA,
          subscriptionId: subA,
          amountCents: 30_000_00,
          method: "transfer",
          reference: "ABC",
        },
      ),
    );
    const after = await getSubscriptionBalance(orgA.id, subA);
    expect(after!.balanceCents).toBe(100_000_00 - paidSoFar - 30_000_00);
  });

  it("permite abonos sin membresía", async () => {
    const created = await withTenant(orgA.id, (tx) =>
      registerPaymentCore(
        tx,
        { orgId: orgA.id, userId: cashier.id },
        { memberId: memberA, amountCents: 1_000_00, method: "other" },
      ),
    );
    expect(created.receiptNumber).toBe(12);
  });

  it("rechaza una membresía que no pertenece al socio", async () => {
    await expect(
      withTenant(orgA.id, async (tx) => {
        const [other] = await tx
          .insert(members)
          .values({ orgId: orgA.id, documentNumber: `3${run}`, firstName: "Caro", lastName: "X" })
          .returning({ id: members.id });
        return registerPaymentCore(
          tx,
          { orgId: orgA.id, userId: cashier.id },
          { memberId: other.id, subscriptionId: subA, amountCents: 100, method: "cash" },
        );
      }),
    ).rejects.toThrow(/membresía/);
  });

  it("anular no borra y deja de contar en saldo y totales", async () => {
    const [target] = await withTenant(orgA.id, (tx) =>
      tx
        .select({ id: payments.id, amount: payments.amountCents })
        .from(payments)
        .where(eq(payments.subscriptionId, subA))
        .limit(1),
    );
    const before = (await getSubscriptionBalance(orgA.id, subA))!;
    await withTenant(orgA.id, (tx) =>
      tx
        .update(payments)
        .set({ status: "voided", voidedAt: new Date(), voidedBy: cashier.id, voidReason: "test" })
        .where(eq(payments.id, target.id)),
    );
    const after = (await getSubscriptionBalance(orgA.id, subA))!;
    expect(after.paidCents).toBe(before.paidCents - target.amount);

    const rows = await withTenant(orgA.id, (tx) =>
      tx.select().from(payments).where(eq(payments.id, target.id)),
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe("voided");

    const list = await listPayments(orgA.id, paymentFiltersSchema.parse({ range: "all" }));
    expect(list.total).toBe(12);
    expect(list.completedTotal).toBe(after.paidCents + 1_000_00);
  });

  it("el cierre de caja agrupa por método y usuario", async () => {
    const today = new Date().toISOString().slice(0, 10);
    const close = await getCashClose(orgA.id, today);
    expect(close.voided).toHaveLength(1);
    expect(close.completed).toHaveLength(11);
    expect(close.byUser[0]?.name).toBe(cashier.name);
    const sumByMethod = close.byMethod.reduce((a, m) => a + m.total, 0);
    expect(sumByMethod).toBe(close.total);
  });

  it("un tenant no ve los pagos de otro", async () => {
    await withTenant(orgB.id, (tx) =>
      registerPaymentCore(
        tx,
        { orgId: orgB.id, userId: null },
        { memberId: memberB, amountCents: 2_000_00, method: "cash" },
      ),
    );
    const listB = await listPayments(orgB.id, paymentFiltersSchema.parse({ range: "all" }));
    expect(listB.total).toBe(1);
    expect(listB.rows[0].receiptNumber).toBe(1);

    const listA = await listPayments(orgA.id, paymentFiltersSchema.parse({ range: "all" }));
    expect(listA.rows.every((r) => r.memberId === memberA || r.memberId !== memberB)).toBe(true);
    expect(listA.total).toBe(12);

    await expect(
      withTenant(orgA.id, (tx) =>
        registerPaymentCore(
          tx,
          { orgId: orgA.id, userId: null },
          { memberId: memberB, amountCents: 100, method: "cash" },
        ),
      ),
    ).rejects.toThrow(/socio/);
  });
});
