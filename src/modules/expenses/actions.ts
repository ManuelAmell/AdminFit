"use server";

import { and, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { expenses } from "@/db/schema";
import { can, ForbiddenError, requirePermission } from "@/lib/auth/authorize";
import { parsePesosInput } from "@/lib/money";
import { withTenant } from "@/lib/tenant";
import { audit } from "@/modules/audit";
import { createExpenseSchema, voidExpenseSchema, type CreateExpenseInput } from "./schema";

export type ActionResult<T = undefined> =
  { ok: true; data: T } | { ok: false; error: string; fieldErrors?: Record<string, string> };

function fail(err: unknown): ActionResult<never> {
  if (err instanceof ForbiddenError) return { ok: false, error: err.message };
  console.error(err);
  return { ok: false, error: "Ocurrió un error inesperado. Intenta de nuevo." };
}

export async function createExpense(
  orgSlug: string,
  input: CreateExpenseInput,
): Promise<ActionResult<{ id: string }>> {
  try {
    const ctx = await requirePermission(orgSlug, { expense: ["create"] });
    // La categoría nómina es sensible incluso al registrarla: solo owner (readPayroll)
    // la usa. Recepción y admin quedan con las demás categorías.
    const parsed = createExpenseSchema.safeParse(input);
    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = String(issue.path[0] ?? "form");
        if (!fieldErrors[key]) fieldErrors[key] = issue.message;
      }
      return { ok: false, error: "Revisa los campos marcados.", fieldErrors };
    }
    const d = parsed.data;
    if (d.category === "payroll" && !can(ctx, { expense: ["readPayroll"] })) {
      return { ok: false, error: "No tienes permiso para registrar nómina." };
    }
    const amountCents = parsePesosInput(d.amount)!;

    const id = await withTenant(ctx.org.id, async (tx) => {
      const [created] = await tx
        .insert(expenses)
        .values({
          orgId: ctx.org.id,
          branchId: d.branchId ?? null,
          category: d.category,
          description: d.description,
          amountCents,
          method: d.method,
          spentAt: d.spentAt ? new Date(d.spentAt) : new Date(),
          recordedBy: ctx.userId,
          notes: d.notes || null,
        })
        .returning({ id: expenses.id });
      await audit(tx, {
        orgId: ctx.org.id,
        actorId: ctx.userId,
        action: "expense.create",
        entity: "expense",
        entityId: created.id,
        diff: { category: d.category, description: d.description, amountCents, method: d.method },
      });
      return created.id;
    });

    revalidatePath(`/app/${orgSlug}/expenses`);
    return { ok: true, data: { id } };
  } catch (err) {
    return fail(err);
  }
}

export async function voidExpense(
  orgSlug: string,
  input: { expenseId: string; reason: string },
): Promise<ActionResult> {
  try {
    const ctx = await requirePermission(orgSlug, { expense: ["void"] });
    const parsed = voidExpenseSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
    }
    const result = await withTenant(ctx.org.id, async (tx) => {
      const [updated] = await tx
        .update(expenses)
        .set({
          status: "voided",
          voidedAt: new Date(),
          voidedBy: ctx.userId,
          voidReason: parsed.data.reason,
        })
        .where(
          and(
            eq(expenses.id, parsed.data.expenseId),
            eq(expenses.status, "completed"),
            isNull(expenses.deletedAt),
          ),
        )
        .returning({ id: expenses.id });
      if (!updated) return null;
      await audit(tx, {
        orgId: ctx.org.id,
        actorId: ctx.userId,
        action: "expense.void",
        entity: "expense",
        entityId: updated.id,
        diff: { reason: parsed.data.reason },
      });
      return updated;
    });
    if (!result) return { ok: false, error: "El gasto no existe o ya estaba anulado." };
    revalidatePath(`/app/${orgSlug}/expenses`);
    revalidatePath(`/app/${orgSlug}/expenses/${parsed.data.expenseId}`);
    return { ok: true, data: undefined };
  } catch (err) {
    return fail(err);
  }
}
