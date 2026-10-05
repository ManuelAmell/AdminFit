import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/db";
import { cashClosures, expenses, organization } from "@/db/schema";
import { todayISO } from "@/lib/dates";
import { withTenant } from "@/lib/tenant";
import { computeExpectedCashCents, getCashClosure } from "@/modules/cash/queries";
import { registerPaymentCore } from "@/modules/payments/core";

// Fase 5.6: cierre de caja. Los pagos/gastos se registran "ahora" (paidAt/spentAt = now),
// así que se calcula sobre el día de hoy en vez de una fecha fija.
const run = Date.now().toString(36);
// "Hoy" en TZ Bogotá, igual que dayRange(): en UTC la fecha cambia a las 7pm locales.
const today = todayISO();

describe("cierre de caja: esperado = base + efectivo cobrado - gastos en efectivo", () => {
  const org = { id: `cash-${run}`, name: "Cash Org", slug: `cash-${run}`, createdAt: new Date() };

  beforeAll(async () => {
    await db.insert(organization).values(org);
    // 2 pagos en efectivo, 1 por tarjeta (no debe contar).
    await withTenant(org.id, (tx) =>
      registerPaymentCore(
        tx,
        { orgId: org.id, userId: null },
        { concept: "day_pass", payerName: "Visitante", amountCents: 15_000_00, method: "cash" },
      ),
    );
    await withTenant(org.id, (tx) =>
      registerPaymentCore(
        tx,
        { orgId: org.id, userId: null },
        { concept: "product", payerName: "Otro", amountCents: 8_000_00, method: "cash" },
      ),
    );
    await withTenant(org.id, (tx) =>
      registerPaymentCore(
        tx,
        { orgId: org.id, userId: null },
        { concept: "product", payerName: "Tarjeta", amountCents: 50_000_00, method: "card" },
      ),
    );
    // 1 gasto en efectivo, 1 por transferencia (no debe restar).
    await withTenant(org.id, (tx) =>
      tx.insert(expenses).values({
        orgId: org.id,
        category: "supplies",
        description: "Aseo",
        amountCents: 5_000_00,
        method: "cash",
      }),
    );
    await withTenant(org.id, (tx) =>
      tx.insert(expenses).values({
        orgId: org.id,
        category: "utilities",
        description: "Internet",
        amountCents: 60_000_00,
        method: "transfer",
      }),
    );
  });

  afterAll(async () => {
    await db.delete(organization).where(eq(organization.id, org.id));
  });

  it("suma efectivo cobrado, resta gastos en efectivo, ignora otros métodos", async () => {
    const openingCashCents = 50_000_00;
    const expected = await computeExpectedCashCents(org.id, today, null, openingCashCents);
    expect(expected).toBe(openingCashCents + (15_000_00 + 8_000_00) - 5_000_00);
  });

  it("un tenant no ve el efectivo de otro", async () => {
    const other = {
      id: `cash-b-${run}`,
      name: "Other",
      slug: `cash-b-${run}`,
      createdAt: new Date(),
    };
    await db.insert(organization).values(other);
    try {
      const expected = await computeExpectedCashCents(other.id, today, null, 0);
      expect(expected).toBe(0);
    } finally {
      await db.delete(organization).where(eq(organization.id, other.id));
    }
  });
});

describe("cierre de caja: unicidad y reapertura", () => {
  const org = {
    id: `cash2-${run}`,
    name: "Cash Org 2",
    slug: `cash2-${run}`,
    createdAt: new Date(),
  };

  beforeAll(async () => {
    await db.insert(organization).values(org);
  });

  afterAll(async () => {
    await db.delete(organization).where(eq(organization.id, org.id));
  });

  it("getCashClosure no encuentra nada antes de cerrar", async () => {
    expect(await getCashClosure(org.id, today, null)).toBeNull();
  });

  it("después de cerrar, getCashClosure lo encuentra con sus totales", async () => {
    await withTenant(org.id, (tx) =>
      tx.insert(cashClosures).values({
        orgId: org.id,
        businessDate: today,
        openingCashCents: 50_000_00,
        countedCashCents: 68_000_00,
        expectedCashCents: 68_000_00,
        differenceCents: 0,
      }),
    );
    const closure = await getCashClosure(org.id, today, null);
    expect(closure?.closure.countedCashCents).toBe(68_000_00);
    expect(closure?.closure.differenceCents).toBe(0);
  });

  it("el índice único rechaza un segundo cierre para el mismo día/sede", async () => {
    await expect(
      withTenant(org.id, (tx) =>
        tx.insert(cashClosures).values({
          orgId: org.id,
          businessDate: today,
          openingCashCents: 0,
          countedCashCents: 0,
          expectedCashCents: 0,
          differenceCents: 0,
        }),
      ),
    ).rejects.toThrow();
  });

  it("reabrir (borrado lógico) hace que getCashClosure deje de encontrarlo", async () => {
    const before = await getCashClosure(org.id, today, null);
    expect(before).not.toBeNull();

    await withTenant(org.id, (tx) =>
      tx
        .update(cashClosures)
        .set({ deletedAt: new Date(), reopenedAt: new Date() })
        .where(eq(cashClosures.id, before!.closure.id)),
    );

    expect(await getCashClosure(org.id, today, null)).toBeNull();
  });

  it("tras reabrir, se puede volver a cerrar el mismo día/sede", async () => {
    await withTenant(org.id, (tx) =>
      tx.insert(cashClosures).values({
        orgId: org.id,
        businessDate: today,
        openingCashCents: 50_000_00,
        countedCashCents: 70_000_00,
        expectedCashCents: 68_000_00,
        differenceCents: 2_000_00,
      }),
    );
    const closure = await getCashClosure(org.id, today, null);
    expect(closure?.closure.differenceCents).toBe(2_000_00);
  });
});
