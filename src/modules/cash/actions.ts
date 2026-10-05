"use server";

import { and, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { cashClosures } from "@/db/schema";
import { can, ForbiddenError, requirePermission } from "@/lib/auth/authorize";
import { parsePesosInput } from "@/lib/money";
import { withTenant } from "@/lib/tenant";
import { audit } from "@/modules/audit";
import { computeExpectedCashCents, getCashClosure } from "./queries";
import { closeCashSchema, reopenCashSchema, type CloseCashInput } from "./schema";

export type ActionResult<T = undefined> =
  { ok: true; data: T } | { ok: false; error: string; fieldErrors?: Record<string, string> };

function fail(err: unknown): ActionResult<never> {
  if (err instanceof ForbiddenError) return { ok: false, error: err.message };
  console.error(err);
  return { ok: false, error: "Ocurrió un error inesperado. Intenta de nuevo." };
}

export async function closeCash(
  orgSlug: string,
  input: CloseCashInput,
): Promise<ActionResult<{ id: string; blind: boolean }>> {
  try {
    const ctx = await requirePermission(orgSlug, { cashClosure: ["create"] });
    const parsed = closeCashSchema.safeParse(input);
    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = String(issue.path[0] ?? "form");
        if (!fieldErrors[key]) fieldErrors[key] = issue.message;
      }
      return { ok: false, error: "Revisa los campos marcados.", fieldErrors };
    }
    const d = parsed.data;
    const branchId = d.branchId ?? null;

    const existing = await getCashClosure(ctx.org.id, d.dateISO, branchId);
    if (existing) {
      return { ok: false, error: "Ya existe un cierre para esta fecha y sede." };
    }

    const openingCashCents = parsePesosInput(d.openingCash)!;
    const countedCashCents = parsePesosInput(d.countedCash)!;
    const expectedCashCents = await computeExpectedCashCents(
      ctx.org.id,
      d.dateISO,
      branchId,
      openingCashCents,
    );
    const differenceCents = countedCashCents - expectedCashCents;

    const id = await withTenant(ctx.org.id, async (tx) => {
      const [created] = await tx
        .insert(cashClosures)
        .values({
          orgId: ctx.org.id,
          branchId,
          businessDate: d.dateISO,
          openingCashCents,
          countedCashCents,
          expectedCashCents,
          differenceCents,
          notes: d.notes || null,
          closedBy: ctx.userId,
        })
        .returning({ id: cashClosures.id });
      // El motivo del arqueo ciego solo tiene sentido si tampoco queda en el audit log
      // (que sí puede leer un owner/admin): se guarda igual, es información operativa,
      // no un secreto — solo se oculta en la UI que ve Recepción.
      await audit(tx, {
        orgId: ctx.org.id,
        actorId: ctx.userId,
        action: "cashClosure.create",
        entity: "cashClosure",
        entityId: created.id,
        diff: {
          businessDate: d.dateISO,
          branchId,
          expectedCashCents,
          countedCashCents,
          differenceCents,
        },
      });
      return created.id;
    });

    revalidatePath(`/app/${orgSlug}/payments/cash-close`);
    revalidatePath(`/app/${orgSlug}/cash`);
    return { ok: true, data: { id, blind: !can(ctx, { cashClosure: ["readAll"] }) } };
  } catch (err) {
    // Carrera entre el chequeo de arriba y el insert: el índice único
    // (org_id, sede, fecha) es el que de verdad lo impide.
    if (err instanceof Error && /cash_closures_org_branch_date_uidx/.test(err.message)) {
      return { ok: false, error: "Ya existe un cierre para esta fecha y sede." };
    }
    return fail(err);
  }
}

export async function reopenCash(
  orgSlug: string,
  input: { closureId: string },
): Promise<ActionResult> {
  try {
    const ctx = await requirePermission(orgSlug, { cashClosure: ["reopen"] });
    const parsed = reopenCashSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: "Datos inválidos" };

    const result = await withTenant(ctx.org.id, async (tx) => {
      const [updated] = await tx
        .update(cashClosures)
        .set({ deletedAt: new Date(), reopenedAt: new Date(), reopenedBy: ctx.userId })
        .where(and(eq(cashClosures.id, parsed.data.closureId), isNull(cashClosures.deletedAt)))
        .returning({ id: cashClosures.id });
      return updated;
    });
    if (!result) return { ok: false, error: "El cierre no existe." };
    revalidatePath(`/app/${orgSlug}/payments/cash-close`);
    revalidatePath(`/app/${orgSlug}/cash`);
    return { ok: true, data: undefined };
  } catch (err) {
    return fail(err);
  }
}
