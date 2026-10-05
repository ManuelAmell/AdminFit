import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/db";
import { members, organization, payments, user } from "@/db/schema";
import { todayISO } from "@/lib/dates";
import { withTenant } from "@/lib/tenant";
import { registerPaymentCore } from "@/modules/payments/core";
import { getCashClose, listPayments } from "@/modules/payments/queries";
import { paymentFiltersSchema } from "@/modules/payments/schema";

// Fase 5.3: venta rápida (pase del día / producto / otro) sin socio. Org propia, aparte
// de payments.test.ts, para no alterar la numeración de recibos que ese archivo verifica.
const run = Date.now().toString(36);
const org = { id: `qs-${run}`, name: "Quick Sale", slug: `qs-${run}`, createdAt: new Date() };
const cashier = `qs-cashier-${run}`;

let memberId: string;

describe("venta rápida: pagos sin socio", () => {
  beforeAll(async () => {
    await db.insert(organization).values(org);
    // receivedBy es FK a user: el cajero tiene que existir.
    await db.insert(user).values({ id: cashier, name: "Cajero QS", email: `${cashier}@test.co` });
    memberId = await withTenant(org.id, async (tx) => {
      const [m] = await tx
        .insert(members)
        .values({ orgId: org.id, documentNumber: `1${run}`, firstName: "Meli", lastName: "Socia" })
        .returning({ id: members.id });
      return m.id;
    });
  });

  afterAll(async () => {
    await db.delete(organization).where(eq(organization.id, org.id));
    await db.delete(user).where(eq(user.id, cashier));
  });

  it("acepta un pase del día sin socio, con nombre de quien paga", async () => {
    const created = await withTenant(org.id, (tx) =>
      registerPaymentCore(
        tx,
        { orgId: org.id, userId: cashier },
        {
          concept: "day_pass",
          payerName: "Visitante Juan",
          amountCents: 15_000_00,
          method: "cash",
        },
      ),
    );
    const [row] = await withTenant(org.id, (tx) =>
      tx.select().from(payments).where(eq(payments.id, created.id)),
    );
    expect(row.memberId).toBeNull();
    expect(row.payerName).toBe("Visitante Juan");
    expect(row.concept).toBe("day_pass");
  });

  it("acepta un producto vendido a un socio existente (sin payerName)", async () => {
    const created = await withTenant(org.id, (tx) =>
      registerPaymentCore(
        tx,
        { orgId: org.id, userId: cashier },
        { concept: "product", memberId, amountCents: 8_000_00, method: "cash" },
      ),
    );
    const [row] = await withTenant(org.id, (tx) =>
      tx.select().from(payments).where(eq(payments.id, created.id)),
    );
    expect(row.memberId).toBe(memberId);
    expect(row.payerName).toBeNull();
  });

  it("rechaza sin socio y sin nombre de quien paga", async () => {
    await expect(
      withTenant(org.id, (tx) =>
        registerPaymentCore(
          tx,
          { orgId: org.id, userId: cashier },
          { concept: "other", amountCents: 5_000_00, method: "cash" },
        ),
      ),
    ).rejects.toThrow(/nombre de quien paga/);
  });

  it("membership exige socio aunque venga concept explícito", async () => {
    await expect(
      withTenant(org.id, (tx) =>
        registerPaymentCore(
          tx,
          { orgId: org.id, userId: cashier },
          { concept: "membership", payerName: "Alguien", amountCents: 5_000_00, method: "cash" },
        ),
      ),
    ).rejects.toThrow(/socio/);
  });

  it("el check de Postgres rechaza un insert directo sin socio ni nombre", async () => {
    await expect(
      withTenant(org.id, (tx) =>
        tx.insert(payments).values({
          orgId: org.id,
          amountCents: 1000,
          method: "cash",
          receiptNumber: 9999,
        }),
      ),
    ).rejects.toThrow();
  });

  it("listPayments y getCashClose muestran payerName sin reventar por el socio nulo", async () => {
    const list = await listPayments(org.id, paymentFiltersSchema.parse({ range: "all" }));
    const dayPassRow = list.rows.find((r) => r.concept === "day_pass");
    expect(dayPassRow?.payerName).toBe("Visitante Juan");
    expect(dayPassRow?.memberFirstName).toBeNull();

    const today = todayISO(); // TZ Bogotá, como getCashClose
    const close = await getCashClose(org.id, today);
    expect(close.completed.some((p) => p.payerName === "Visitante Juan")).toBe(true);
  });
});
