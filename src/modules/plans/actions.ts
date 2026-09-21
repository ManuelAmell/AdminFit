"use server";

import { and, count, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { plans, subscriptions } from "@/db/schema";
import { ForbiddenError, requirePermission } from "@/lib/auth/authorize";
import { withTenant } from "@/lib/tenant";
import { audit } from "@/modules/audit";
import { planIdSchema, planInputSchema, type PlanInput } from "./schema";

export type ActionResult<T = undefined> =
  { ok: true; data: T } | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

function fail(error: unknown): ActionResult<never> {
  if (error instanceof ForbiddenError) return { ok: false, error: error.message };
  console.error(error);
  return { ok: false, error: "Algo salió mal. Intenta de nuevo." };
}

function fieldErrorsOf(err: { issues: { path: PropertyKey[]; message: string }[] }) {
  const out: Record<string, string[]> = {};
  for (const issue of err.issues) {
    const key = String(issue.path[0] ?? "_");
    (out[key] ??= []).push(issue.message);
  }
  return out;
}

export async function createPlan(
  orgSlug: string,
  input: PlanInput,
): Promise<ActionResult<{ id: string }>> {
  const parsed = planInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Revisa los campos.", fieldErrors: fieldErrorsOf(parsed.error) };
  }
  try {
    const { org, userId } = await requirePermission(orgSlug, { plan: ["create"] });
    const v = parsed.data;
    const id = await withTenant(org.id, async (tx) => {
      const [{ n }] = await tx
        .select({ n: count() })
        .from(plans)
        .where(and(eq(plans.orgId, org.id), isNull(plans.deletedAt)));
      const [row] = await tx
        .insert(plans)
        .values({
          orgId: org.id,
          name: v.name,
          description: v.description || null,
          priceCents: v.price,
          durationType: v.durationType,
          durationValue: v.durationValue,
          visitLimit: v.visitLimit,
          color: v.color,
          isActive: v.isActive,
          sortOrder: n,
        })
        .returning({ id: plans.id });
      await audit(tx, {
        orgId: org.id,
        actorId: userId,
        action: "plan.create",
        entity: "plan",
        entityId: row.id,
        diff: { name: v.name, priceCents: v.price },
      });
      return row.id;
    });
    revalidatePath(`/app/${orgSlug}/plans`);
    return { ok: true, data: { id } };
  } catch (e) {
    return fail(e);
  }
}

export async function updatePlan(
  orgSlug: string,
  planId: string,
  input: PlanInput,
): Promise<ActionResult> {
  const idParsed = planIdSchema.safeParse({ planId });
  const parsed = planInputSchema.safeParse(input);
  if (!idParsed.success) return { ok: false, error: "Plan inválido." };
  if (!parsed.success) {
    return { ok: false, error: "Revisa los campos.", fieldErrors: fieldErrorsOf(parsed.error) };
  }
  try {
    const { org, userId } = await requirePermission(orgSlug, { plan: ["update"] });
    const v = parsed.data;
    const updated = await withTenant(org.id, async (tx) => {
      const [before] = await tx
        .select()
        .from(plans)
        .where(and(eq(plans.id, planId), eq(plans.orgId, org.id), isNull(plans.deletedAt)));
      if (!before) return false;
      await tx
        .update(plans)
        .set({
          name: v.name,
          description: v.description || null,
          priceCents: v.price,
          durationType: v.durationType,
          durationValue: v.durationValue,
          visitLimit: v.visitLimit,
          color: v.color,
          isActive: v.isActive,
        })
        .where(eq(plans.id, planId));
      await audit(tx, {
        orgId: org.id,
        actorId: userId,
        action: "plan.update",
        entity: "plan",
        entityId: planId,
        diff: {
          before: { name: before.name, priceCents: before.priceCents, isActive: before.isActive },
          after: { name: v.name, priceCents: v.price, isActive: v.isActive },
        },
      });
      return true;
    });
    if (!updated) return { ok: false, error: "El plan no existe." };
    revalidatePath(`/app/${orgSlug}/plans`);
    return { ok: true, data: undefined };
  } catch (e) {
    return fail(e);
  }
}

// Archivar = isActive false. Si no tiene suscripciones, se elimina (soft delete).
export async function archivePlan(orgSlug: string, planId: string): Promise<ActionResult> {
  if (!planIdSchema.safeParse({ planId }).success) return { ok: false, error: "Plan inválido." };
  try {
    const { org, userId } = await requirePermission(orgSlug, { plan: ["archive"] });
    const result = await withTenant(org.id, async (tx) => {
      const [{ n }] = await tx
        .select({ n: count() })
        .from(subscriptions)
        .where(eq(subscriptions.planId, planId));
      const hasSubscriptions = n > 0;
      const [row] = await tx
        .update(plans)
        .set(hasSubscriptions ? { isActive: false } : { isActive: false, deletedAt: new Date() })
        .where(and(eq(plans.id, planId), eq(plans.orgId, org.id), isNull(plans.deletedAt)))
        .returning({ id: plans.id });
      if (!row) return null;
      await audit(tx, {
        orgId: org.id,
        actorId: userId,
        action: hasSubscriptions ? "plan.archive" : "plan.delete",
        entity: "plan",
        entityId: planId,
      });
      return hasSubscriptions ? "archived" : "deleted";
    });
    if (!result) return { ok: false, error: "El plan no existe." };
    revalidatePath(`/app/${orgSlug}/plans`);
    return { ok: true, data: undefined };
  } catch (e) {
    return fail(e);
  }
}

export async function restorePlan(orgSlug: string, planId: string): Promise<ActionResult> {
  if (!planIdSchema.safeParse({ planId }).success) return { ok: false, error: "Plan inválido." };
  try {
    const { org, userId } = await requirePermission(orgSlug, { plan: ["update"] });
    await withTenant(org.id, async (tx) => {
      await tx
        .update(plans)
        .set({ isActive: true })
        .where(and(eq(plans.id, planId), eq(plans.orgId, org.id), isNull(plans.deletedAt)));
      await audit(tx, {
        orgId: org.id,
        actorId: userId,
        action: "plan.restore",
        entity: "plan",
        entityId: planId,
      });
    });
    revalidatePath(`/app/${orgSlug}/plans`);
    return { ok: true, data: undefined };
  } catch (e) {
    return fail(e);
  }
}
