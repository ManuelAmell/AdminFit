"use server";

import { and, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { payments } from "@/db/schema";
import { ForbiddenError, requirePermission } from "@/lib/auth/authorize";
import { parsePesosInput } from "@/lib/money";
import { withTenant } from "@/lib/tenant";
import { audit } from "@/modules/audit";
import { registerPaymentCore } from "./core";
import { getMemberBillingContext, searchMembers } from "./queries";
import { registerPaymentSchema, voidPaymentSchema, type RegisterPaymentInput } from "./schema";

export type ActionResult<T = undefined> =
  { ok: true; data: T } | { ok: false; error: string; fieldErrors?: Record<string, string> };

function fail(err: unknown): ActionResult<never> {
  if (err instanceof ForbiddenError) return { ok: false, error: err.message };
  console.error(err);
  return { ok: false, error: "Ocurrió un error inesperado. Intenta de nuevo." };
}

export async function registerPayment(
  orgSlug: string,
  input: RegisterPaymentInput,
): Promise<ActionResult<{ id: string; receiptNumber: number }>> {
  try {
    const ctx = await requirePermission(orgSlug, { payment: ["create"] });
    const parsed = registerPaymentSchema.safeParse(input);
    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = String(issue.path[0] ?? "form");
        if (!fieldErrors[key]) fieldErrors[key] = issue.message;
      }
      return { ok: false, error: "Revisa los campos marcados.", fieldErrors };
    }
    const d = parsed.data;
    const amountCents = parsePesosInput(d.amount)!;
    const created = await withTenant(ctx.org.id, (tx) =>
      registerPaymentCore(
        tx,
        { orgId: ctx.org.id, userId: ctx.userId },
        {
          memberId: d.memberId,
          subscriptionId: d.subscriptionId ?? null,
          amountCents,
          method: d.method,
          reference: d.reference,
          paidAt: d.paidAt ? new Date(d.paidAt) : undefined,
          notes: d.notes,
        },
      ),
    );
    revalidatePath(`/app/${orgSlug}/payments`);
    return { ok: true, data: created };
  } catch (err) {
    if (
      err instanceof Error &&
      !(err instanceof ForbiddenError) &&
      /socio|membresía/.test(err.message)
    ) {
      return { ok: false, error: err.message };
    }
    return fail(err);
  }
}

export async function voidPayment(
  orgSlug: string,
  input: { paymentId: string; reason: string },
): Promise<ActionResult> {
  try {
    const ctx = await requirePermission(orgSlug, { payment: ["void"] });
    const parsed = voidPaymentSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
    }
    const result = await withTenant(ctx.org.id, async (tx) => {
      const [updated] = await tx
        .update(payments)
        .set({
          status: "voided",
          voidedAt: new Date(),
          voidedBy: ctx.userId,
          voidReason: parsed.data.reason,
        })
        .where(
          and(
            eq(payments.id, parsed.data.paymentId),
            eq(payments.status, "completed"),
            isNull(payments.deletedAt),
          ),
        )
        .returning({ id: payments.id, receiptNumber: payments.receiptNumber });
      if (!updated) return null;
      await audit(tx, {
        orgId: ctx.org.id,
        actorId: ctx.userId,
        action: "payment.void",
        entity: "payment",
        entityId: updated.id,
        diff: { reason: parsed.data.reason, receiptNumber: updated.receiptNumber },
      });
      return updated;
    });
    if (!result) return { ok: false, error: "El pago no existe o ya estaba anulado." };
    revalidatePath(`/app/${orgSlug}/payments`);
    revalidatePath(`/app/${orgSlug}/payments/${parsed.data.paymentId}`);
    return { ok: true, data: undefined };
  } catch (err) {
    return fail(err);
  }
}

export async function searchMembersAction(orgSlug: string, query: string) {
  const ctx = await requirePermission(orgSlug, { gymMember: ["read"] });
  return searchMembers(ctx.org.id, query);
}

export async function getMemberBillingContextAction(orgSlug: string, memberId: string) {
  const ctx = await requirePermission(orgSlug, { payment: ["read"] });
  return getMemberBillingContext(ctx.org.id, memberId);
}
