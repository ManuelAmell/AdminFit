import { and, eq, isNull, sql } from "drizzle-orm";
import { members, orgSettings, payments, subscriptions } from "@/db/schema";
import type { TenantDb } from "@/lib/tenant";
import { audit } from "@/modules/audit";

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
    memberId: string;
    subscriptionId?: string | null;
    amountCents: number;
    method: "cash" | "transfer" | "card" | "other";
    reference?: string | null;
    paidAt?: Date;
    notes?: string | null;
  },
) {
  const [member] = await tx
    .select({ id: members.id, branchId: members.branchId })
    .from(members)
    .where(and(eq(members.id, data.memberId), isNull(members.deletedAt)))
    .limit(1);
  if (!member) throw new Error("El socio no existe en este gimnasio.");

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

  const { receiptNumber } = await nextReceiptNumberTx(tx, ctx.orgId);
  const [created] = await tx
    .insert(payments)
    .values({
      orgId: ctx.orgId,
      memberId: data.memberId,
      subscriptionId: data.subscriptionId ?? null,
      branchId: member.branchId,
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
      memberId: data.memberId,
      subscriptionId: data.subscriptionId ?? null,
      amountCents: data.amountCents,
      method: data.method,
      receiptNumber,
    },
  });
  return created;
}
