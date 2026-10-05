"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { platformPlans, tenantSubscriptions, platformSettings } from "@/db/schema";
import { requireSuperadmin } from "@/lib/auth/session";
import { todayISO, addDaysISO } from "@/lib/dates";
import {
  platformPlanSchema,
  assignSubscriptionSchema,
  platformSettingsSchema,
  type PlatformPlanInput,
  type AssignSubscriptionInput,
  type PlatformSettingsInput,
} from "./schema";

export type ActionResult<T = undefined> = { ok: true; data: T } | { ok: false; error: string };

// ─── Planes SaaS ────────────────────────────────────────────

export async function createPlatformPlan(
  input: PlatformPlanInput,
): Promise<ActionResult<{ id: string }>> {
  await requireSuperadmin();
  const parsed = platformPlanSchema.safeParse(input);
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };

  try {
    const v = parsed.data;
    const [row] = await db
      .insert(platformPlans)
      .values({
        name: v.name,
        description: v.description || null,
        priceCents: v.price,
        maxMembers: v.maxMembers,
        maxBranches: v.maxBranches,
        maxStaff: v.maxStaff,
        isActive: v.isActive,
      })
      .returning({ id: platformPlans.id });
    revalidatePath("/admin");
    revalidatePath("/admin/plans");
    return { ok: true, data: { id: row.id } };
  } catch (err) {
    console.error(err);
    return { ok: false, error: "No se pudo crear el plan." };
  }
}

export async function updatePlatformPlan(
  planId: string,
  input: PlatformPlanInput,
): Promise<ActionResult> {
  await requireSuperadmin();
  const parsed = platformPlanSchema.safeParse(input);
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };

  try {
    const v = parsed.data;
    await db
      .update(platformPlans)
      .set({
        name: v.name,
        description: v.description || null,
        priceCents: v.price,
        maxMembers: v.maxMembers,
        maxBranches: v.maxBranches,
        maxStaff: v.maxStaff,
        isActive: v.isActive,
      })
      .where(eq(platformPlans.id, planId));
    revalidatePath("/admin");
    revalidatePath("/admin/plans");
    return { ok: true, data: undefined };
  } catch (err) {
    console.error(err);
    return { ok: false, error: "No se pudo actualizar el plan." };
  }
}

export async function deletePlatformPlan(planId: string): Promise<ActionResult> {
  await requireSuperadmin();
  try {
    await db.delete(platformPlans).where(eq(platformPlans.id, planId));
    revalidatePath("/admin");
    revalidatePath("/admin/plans");
    return { ok: true, data: undefined };
  } catch (err) {
    console.error(err);
    return { ok: false, error: "No se pudo eliminar. Puede tener suscripciones asociadas." };
  }
}

// ─── Suscripciones ──────────────────────────────────────────

export async function assignSubscription(
  input: AssignSubscriptionInput,
): Promise<ActionResult<{ id: string }>> {
  const session = await requireSuperadmin();
  const parsed = assignSubscriptionSchema.safeParse(input);
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };

  try {
    const v = parsed.data;
    const plan = await db.query.platformPlans.findFirst({
      where: eq(platformPlans.id, v.planId),
    });
    if (!plan) return { ok: false, error: "Plan no encontrado." };

    const startDate = todayISO();
    const endDate = addDaysISO(startDate, v.durationDays);

    const [row] = await db
      .insert(tenantSubscriptions)
      .values({
        orgId: v.orgId,
        planId: v.planId,
        status: v.status,
        startDate,
        endDate,
        priceCentsSnapshot: plan.priceCents,
        notes: v.notes || null,
        assignedBy: session.user.id,
      })
      .returning({ id: tenantSubscriptions.id });

    revalidatePath("/admin");
    revalidatePath("/admin/gyms");
    revalidatePath(`/admin/${v.orgId}/subscription`);
    return { ok: true, data: { id: row.id } };
  } catch (err) {
    console.error(err);
    return { ok: false, error: "No se pudo asignar la suscripción." };
  }
}

// ─── Datos bancarios ────────────────────────────────────────

export async function updatePlatformSettings(input: PlatformSettingsInput): Promise<ActionResult> {
  await requireSuperadmin();
  const parsed = platformSettingsSchema.safeParse(input);
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };

  try {
    const v = parsed.data;
    const existing = await db.select().from(platformSettings).limit(1);

    if (existing.length > 0) {
      await db
        .update(platformSettings)
        .set({
          bankHolderName: v.bankHolderName || null,
          bankName: v.bankName || null,
          bankAccountType: v.bankAccountType ?? null,
          bankAccountNumber: v.bankAccountNumber || null,
          nequiNumber: v.nequiNumber || null,
          additionalInfo: v.additionalInfo || null,
        })
        .where(eq(platformSettings.id, existing[0].id));
    } else {
      await db.insert(platformSettings).values({
        bankHolderName: v.bankHolderName || null,
        bankName: v.bankName || null,
        bankAccountType: v.bankAccountType ?? null,
        bankAccountNumber: v.bankAccountNumber || null,
        nequiNumber: v.nequiNumber || null,
        additionalInfo: v.additionalInfo || null,
      });
    }

    revalidatePath("/admin");
    revalidatePath("/admin/billing");
    return { ok: true, data: undefined };
  } catch (err) {
    console.error(err);
    return { ok: false, error: "No se pudieron guardar los datos bancarios." };
  }
}
