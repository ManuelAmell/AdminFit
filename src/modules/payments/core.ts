import { and, eq, isNull, sql } from "drizzle-orm";
import { members, orgSettings, payments, subscriptions } from "@/db/schema";
import type { TenantDb } from "@/lib/tenant";
import { audit } from "@/modules/audit";
import type { PaymentConcept } from "./constants";

// Toma el siguiente número de recibo de forma atómica (fila bloqueada por el UPDATE).
export async function nextReceiptNumberTx(tx: TenantDb, orgId: string) {
  await tx.insert(orgSettings).values({ orgId }).onConflictDoNothing({ target: orgSettings.orgId });
  const [row] = await tx
    .update(orgSettings)
    .set({ nextReceiptNumber: sql`${orgSettings.nextReceiptNumber} + 1` })
    .where(eq(orgSettings.orgId, orgId))
    .returning({ next: orgSettings.nextReceiptNumber, prefix: orgSettings.receiptPrefix });
  if (!row) throw new Error("No se pudo asignar número de recibo");
  return { receiptNumber: row.next - 1, prefix: row.prefix };
}

export async function registerPaymentCore(
  tx: TenantDb,
  ctx: { orgId: string; userId: string | null },
  data: {
    // "membership" exige memberId (como siempre); day_pass/product/other pueden ir sin
    // socio, y entonces payerName es obligatorio (ver checks en el schema de payments).
    concept?: PaymentConcept;
    memberId?: string | null;
    payerName?: string | null;
    subscriptionId?: string | null;
    branchId?: string | null;
    amountCents: number;
    method: "cash" | "transfer" | "card" | "other";
    reference?: string | null;
    paidAt?: Date;
    notes?: string | null;
  },
) {
  const concept = data.concept ?? "membership";
  let branchId = data.branchId ?? null;

  if (data.memberId) {
    const [member] = await tx
      .select({ id: members.id, branchId: members.branchId })
      .from(members)
      .where(and(eq(members.id, data.memberId), isNull(members.deletedAt)))
      .limit(1);
    if (!member) throw new Error("El socio no existe en este gimnasio.");
    branchId = member.branchId ?? branchId;

    if (data.subscriptionId) {
      const [sub] = await tx
        .select({ id: subscriptions.id, memberId: subscriptions.memberId })
        .from(subscriptions)
        .where(and(eq(subscriptions.id, data.subscriptionId), isNull(subscriptions.deletedAt)))
        .limit(1);
      if (!sub || sub.memberId !== data.memberId) {
        throw new Error("La membresía no corresponde a este socio.");
      }
    }
  } else if (concept === "membership") {
    throw new Error("Selecciona un socio.");
  } else if (!data.payerName?.trim()) {
    throw new Error("Ingresa el nombre de quien paga.");
  }

  const { receiptNumber } = await nextReceiptNumberTx(tx, ctx.orgId);
  const [created] = await tx
    .insert(payments)
    .values({
      orgId: ctx.orgId,
      memberId: data.memberId ?? null,
      payerName: data.memberId ? null : (data.payerName?.trim() ?? null),
      concept,
      subscriptionId: data.subscriptionId ?? null,
      branchId,
      amountCents: data.amountCents,
      method: data.method,
      reference: data.reference || null,
      paidAt: data.paidAt ?? new Date(),
      receiptNumber,
      receivedBy: ctx.userId,
      notes: data.notes || null,
    })
    .returning({ id: payments.id, receiptNumber: payments.receiptNumber });

  await audit(tx, {
    orgId: ctx.orgId,
    actorId: ctx.userId,
    action: "payment.create",
    entity: "payment",
    entityId: created.id,
    diff: {
      concept,
      memberId: data.memberId ?? null,
      payerName: data.memberId ? null : (data.payerName?.trim() ?? null),
      subscriptionId: data.subscriptionId ?? null,
      amountCents: data.amountCents,
      method: data.method,
      receiptNumber,
    },
  });
  return created;
}
