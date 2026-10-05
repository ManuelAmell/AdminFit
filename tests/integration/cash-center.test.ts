import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/db";
import { cashClosures, expenses, organization, user } from "@/db/schema";
import { addDaysISO, todayISO } from "@/lib/dates";
import { withTenant } from "@/lib/tenant";
import {
  getCashierStats,
  getDailyCashMovements,
  getPaymentMethodMix,
  listClosuresInRange,
} from "@/modules/cash/queries";
import { registerPaymentCore } from "@/modules/payments/core";

// Fase 6.A: queries del Centro de caja contra Postgres real (RLS incluida).
const run = Date.now().toString(36);
const today = todayISO();
const from = addDaysISO(today, -6);

describe("centro de caja", () => {
  const org = { id: `cc-${run}`, name: "CC Org", slug: `cc-${run}`, createdAt: new Date() };
  const other = { id: `cc-b-${run}`, name: "CC Other", slug: `cc-b-${run}`, createdAt: new Date() };
  const cashier = { id: `cc-u-${run}`, name: "Cajera Ana", email: `ana-${run}@test.co` };

  beforeAll(async () => {
    await db.insert(organization).values([org, other]);
    await db.insert(user).values({ ...cashier, emailVerified: false });
    const ctx = { orgId: org.id, userId: cashier.id };
    await withTenant(org.id, (tx) =>
      registerPaymentCore(tx, ctx, {
        concept: "day_pass",
        payerName: "A",
        amountCents: 20_000_00,
        method: "cash",
      }),
    );
    await withTenant(org.id, (tx) =>
      registerPaymentCore(tx, ctx, {
        concept: "product",
        payerName: "B",
        amountCents: 30_000_00,
        method: "transfer",
      }),
    );
    await withTenant(org.id, (tx) =>
      tx.insert(expenses).values({
        orgId: org.id,
        category: "supplies",
        description: "Aseo",
        amountCents: 4_000_00,
        method: "cash",
      }),
    );
    await withTenant(org.id, (tx) =>
      tx.insert(cashClosures).values([
        {
          orgId: org.id,
          businessDate: addDaysISO(today, -1),
          openingCashCents: 0,
          expectedCashCents: 10_000_00,
          countedCashCents: 7_000_00,
          differenceCents: -3_000_00,
          closedBy: cashier.id,
        },
        // Fuera del rango: no debe aparecer.
        {
          orgId: org.id,
          businessDate: addDaysISO(today, -30),
          openingCashCents: 0,
          expectedCashCents: 1,
          countedCashCents: 1,
          differenceCents: 0,
        },
      ]),
    );
  });

  afterAll(async () => {
    await db.delete(organization).where(eq(organization.id, org.id));
    await db.delete(organization).where(eq(organization.id, other.id));
    await db.delete(user).where(eq(user.id, cashier.id));
  });

  it("movimientos del día separan efectivo, otros medios y gastos en efectivo", async () => {
    const moves = await getDailyCashMovements(org.id, from, today);
    expect(moves).toEqual([
      { date: today, cashInCents: 20_000_00, otherInCents: 30_000_00, cashOutCents: 4_000_00 },
    ]);
  });

  it("mezcla de métodos ordenada por monto", async () => {
    const mix = await getPaymentMethodMix(org.id, from, today);
    expect(mix.map((m) => [m.method, m.cents, m.n])).toEqual([
      ["transfer", 30_000_00, 1],
      ["cash", 20_000_00, 1],
    ]);
  });

  it("cierres dentro del rango, con nombre de quien cerró", async () => {
    const { closures, reopenedCount } = await listClosuresInRange(org.id, from, today);
    expect(closures).toHaveLength(1);
    expect(closures[0].closedByName).toBe("Cajera Ana");
    expect(reopenedCount).toBe(0);
  });

  it("estadísticas por cajero combinan cobros y cierres", async () => {
    const [stat] = await getCashierStats(org.id, from, today, 1_000_00);
    expect(stat).toMatchObject({
      name: "Cajera Ana",
      paymentsN: 2,
      paymentsCents: 50_000_00,
      cashCents: 20_000_00,
      closuresN: 1,
      diffCents: -3_000_00,
      shortClosuresN: 1,
    });
  });

  it("otro tenant no ve nada", async () => {
    expect(await getDailyCashMovements(other.id, from, today)).toEqual([]);
    expect(await getPaymentMethodMix(other.id, from, today)).toEqual([]);
    expect((await listClosuresInRange(other.id, from, today)).closures).toEqual([]);
    expect(await getCashierStats(other.id, from, today, 0)).toEqual([]);
  });
});
