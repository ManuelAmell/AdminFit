"use server";

import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { members, plans, subscriptions } from "@/db/schema";
import { ForbiddenError, requirePermission } from "@/lib/auth/authorize";
import { todayISO } from "@/lib/dates";
import { withTenant, type TenantDb } from "@/lib/tenant";
import { audit } from "@/modules/audit";
import {
  canCancel,
  canFreeze,
  canRenew,
  computeEndDate,
  extendedEndDateAfterFreeze,
  renewalStartDate,
} from "./rules";
import {
  cancelSubscriptionSchema,
  freezeSubscriptionSchema,
  renewSubscriptionSchema,
  sellSubscriptionSchema,
  unfreezeSubscriptionSchema,
  type SellSubscriptionInput,
} from "./schema";

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

function err(error: string) {
  return { ok: false as const, error };
}

function revalidate(orgSlug: string, memberId?: string) {
  revalidatePath(`/app/${orgSlug}/memberships`);
  revalidatePath(`/app/${orgSlug}/dashboard`);
  if (memberId) revalidatePath(`/app/${orgSlug}/members/${memberId}`);
}

async function loadActivePlan(tx: TenantDb, orgId: string, planId: string) {
  const [plan] = await tx
    .select()
    .from(plans)
    .where(and(eq(plans.id, planId), eq(plans.orgId, orgId), isNull(plans.deletedAt)))
    .limit(1);
  return plan ?? null;
}

async function loadCurrentSubscription(tx: TenantDb, orgId: string, memberId: string) {
  const [current] = await tx
    .select()
    .from(subscriptions)
    .where(
      and(
        eq(subscriptions.orgId, orgId),
        eq(subscriptions.memberId, memberId),
        isNull(subscriptions.deletedAt),
        inArray(subscriptions.status, ["active", "frozen"]),
      ),
    )
    .orderBy(desc(subscriptions.endDate))
    .limit(1);
  return current ?? null;
}

// Vende una membresía. NO registra el pago (módulo de pagos); devuelve el id para enlazarlo.
export async function sellSubscription(
  orgSlug: string,
  input: SellSubscriptionInput,
): Promise<ActionResult<{ id: string; startDate: string; endDate: string; priceCents: number }>> {
  const parsed = sellSubscriptionSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Revisa los campos.", fieldErrors: fieldErrorsOf(parsed.error) };
  }
  try {
    const { org, userId } = await requirePermission(orgSlug, { subscription: ["create"] });
    const v = parsed.data;
    const today = todayISO(org.timezone ?? undefined);

    const result = await withTenant(org.id, async (tx) => {
      const [member] = await tx
        .select({ id: members.id, status: members.status })
        .from(members)
        .where(
          and(eq(members.id, v.memberId), eq(members.orgId, org.id), isNull(members.deletedAt)),
        )
        .limit(1);
      if (!member) return err("El socio no existe.");

      const plan = await loadActivePlan(tx, org.id, v.planId);
      if (!plan) return err("El plan no existe.");
      if (!plan.isActive) return err("El plan está archivado.");

      const current = await loadCurrentSubscription(tx, org.id, member.id);
      if (current?.status === "frozen") {
        return err("El socio tiene una membresía congelada. Descongélala primero.");
      }

      // Sin fecha explícita: encadena a la vigente (si la hay) o empieza hoy.
      const startDate =
        v.startDate && v.startDate !== ""
          ? v.startDate
          : renewalStartDate(current?.endDate ?? null, today);
      const endDate = computeEndDate(startDate, plan.durationType, plan.durationValue);

      const [row] = await tx
        .insert(subscriptions)
        .values({
          orgId: org.id,
          memberId: member.id,
          planId: plan.id,
          startDate,
          endDate,
          status: "active",
          priceCentsSnapshot: plan.priceCents,
          visitLimitSnapshot: plan.visitLimit,
          notes: v.notes || null,
          soldBy: userId,
        })
        .returning({ id: subscriptions.id });

      // La anterior, si sigue "active" pero ya la reemplazó una nueva que empieza después, se deja
      // tal cual: expira sola. Si ya venció, se marca expired para no contarla dos veces.
      if (current && current.status === "active" && current.endDate < today) {
        await tx
          .update(subscriptions)
          .set({ status: "expired" })
          .where(eq(subscriptions.id, current.id));
      }

      await audit(tx, {
        orgId: org.id,
        actorId: userId,
        action: "subscription.sell",
        entity: "subscription",
        entityId: row.id,
        diff: {
          memberId: member.id,
          planId: plan.id,
          startDate,
          endDate,
          priceCents: plan.priceCents,
        },
      });
      return { ok: true as const, id: row.id, startDate, endDate, priceCents: plan.priceCents };
    });

    if (!result.ok) return { ok: false, error: result.error };
    revalidate(orgSlug, v.memberId);
    const { ok: _ok, ...data } = result;
    void _ok;
    return { ok: true, data };
  } catch (e) {
    return fail(e);
  }
}

// Renueva: nueva membresía con el mismo plan (o uno distinto) encadenada al fin de la actual.
export async function renewSubscription(
  orgSlug: string,
  input: { subscriptionId: string; planId?: string; notes?: string },
): Promise<ActionResult<{ id: string; startDate: string; endDate: string; priceCents: number }>> {
  const parsed = renewSubscriptionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Datos inválidos." };
  try {
    const { org, userId } = await requirePermission(orgSlug, { subscription: ["renew"] });
    const v = parsed.data;
    const today = todayISO(org.timezone ?? undefined);

    const result = await withTenant(org.id, async (tx) => {
      const [current] = await tx
        .select()
        .from(subscriptions)
        .where(and(eq(subscriptions.id, v.subscriptionId), eq(subscriptions.orgId, org.id)))
        .limit(1);
      if (!current) return err("La membresía no existe.");
      if (!canRenew(current)) return err("Esta membresía no se puede renovar.");

      const plan = await loadActivePlan(tx, org.id, v.planId ?? current.planId);
      if (!plan || !plan.isActive) return err("El plan no está disponible.");

      const startDate = renewalStartDate(current.endDate, today);
      const endDate = computeEndDate(startDate, plan.durationType, plan.durationValue);

      const [row] = await tx
        .insert(subscriptions)
        .values({
          orgId: org.id,
          memberId: current.memberId,
          planId: plan.id,
          startDate,
          endDate,
          status: "active",
          priceCentsSnapshot: plan.priceCents,
          visitLimitSnapshot: plan.visitLimit,
          notes: v.notes || null,
          soldBy: userId,
        })
        .returning({ id: subscriptions.id });

      if (current.status === "active" && current.endDate < today) {
        await tx
          .update(subscriptions)
          .set({ status: "expired" })
          .where(eq(subscriptions.id, current.id));
      }

      await audit(tx, {
        orgId: org.id,
        actorId: userId,
        action: "subscription.renew",
        entity: "subscription",
        entityId: row.id,
        diff: { from: current.id, planId: plan.id, startDate, endDate },
      });
      return {
        ok: true as const,
        id: row.id,
        startDate,
        endDate,
        priceCents: plan.priceCents,
        memberId: current.memberId,
      };
    });

    if (!result.ok) return { ok: false, error: result.error };
    revalidate(orgSlug, result.memberId);
    const { ok: _ok, memberId: _m, ...data } = result;
    void _ok;
    void _m;
    return { ok: true, data };
  } catch (e) {
    return fail(e);
  }
}

export async function freezeSubscription(
  orgSlug: string,
  input: { subscriptionId: string; frozenUntil?: string },
): Promise<ActionResult> {
  const parsed = freezeSubscriptionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Datos inválidos." };
  try {
    const { org, userId } = await requirePermission(orgSlug, { subscription: ["freeze"] });
    const today = todayISO(org.timezone ?? undefined);
    const frozenUntil = parsed.data.frozenUntil || null;
    if (frozenUntil && frozenUntil < today) {
      return { ok: false, error: "La fecha de reactivación debe ser hoy o después." };
    }

    const result = await withTenant(org.id, async (tx) => {
      const [current] = await tx
        .select()
        .from(subscriptions)
        .where(
          and(eq(subscriptions.id, parsed.data.subscriptionId), eq(subscriptions.orgId, org.id)),
        )
        .limit(1);
      if (!current) return err("La membresía no existe.");
      if (!canFreeze(current, today)) {
        return err("Solo se puede congelar una membresía activa y vigente.");
      }
      await tx
        .update(subscriptions)
        .set({ status: "frozen", frozenAt: today, frozenUntil })
        .where(eq(subscriptions.id, current.id));
      await audit(tx, {
        orgId: org.id,
        actorId: userId,
        action: "subscription.freeze",
        entity: "subscription",
        entityId: current.id,
        diff: { frozenAt: today, frozenUntil },
      });
      return { ok: true as const, memberId: current.memberId };
    });

    if (!result.ok) return { ok: false, error: result.error };
    revalidate(orgSlug, result.memberId);
    return { ok: true, data: undefined };
  } catch (e) {
    return fail(e);
  }
}

export async function unfreezeSubscription(
  orgSlug: string,
  input: { subscriptionId: string },
): Promise<ActionResult<{ endDate: string }>> {
  const parsed = unfreezeSubscriptionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Datos inválidos." };
  try {
    const { org, userId } = await requirePermission(orgSlug, { subscription: ["freeze"] });
    const today = todayISO(org.timezone ?? undefined);

    const result = await withTenant(org.id, async (tx) => {
      const [current] = await tx
        .select()
        .from(subscriptions)
        .where(
          and(eq(subscriptions.id, parsed.data.subscriptionId), eq(subscriptions.orgId, org.id)),
        )
        .limit(1);
      if (!current) return err("La membresía no existe.");
      if (current.status !== "frozen" || !current.frozenAt) {
        return err("La membresía no está congelada.");
      }
      const endDate = extendedEndDateAfterFreeze(current.endDate, current.frozenAt, today);
      await tx
        .update(subscriptions)
        .set({ status: "active", endDate, frozenAt: null, frozenUntil: null })
        .where(eq(subscriptions.id, current.id));
      await audit(tx, {
        orgId: org.id,
        actorId: userId,
        action: "subscription.unfreeze",
        entity: "subscription",
        entityId: current.id,
        diff: { from: current.endDate, to: endDate, frozenAt: current.frozenAt, unfrozenAt: today },
      });
      return { ok: true as const, endDate, memberId: current.memberId };
    });

    if (!result.ok) return { ok: false, error: result.error };
    revalidate(orgSlug, result.memberId);
    return { ok: true, data: { endDate: result.endDate } };
  } catch (e) {
    return fail(e);
  }
}

export async function cancelSubscription(
  orgSlug: string,
  input: { subscriptionId: string; reason: string },
): Promise<ActionResult> {
  const parsed = cancelSubscriptionSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Revisa los campos.", fieldErrors: fieldErrorsOf(parsed.error) };
  }
  try {
    const { org, userId } = await requirePermission(orgSlug, { subscription: ["cancel"] });
    const result = await withTenant(org.id, async (tx) => {
      const [current] = await tx
        .select()
        .from(subscriptions)
        .where(
          and(eq(subscriptions.id, parsed.data.subscriptionId), eq(subscriptions.orgId, org.id)),
        )
        .limit(1);
      if (!current) return err("La membresía no existe.");
      if (!canCancel(current)) return err("Esta membresía ya no está vigente.");
      await tx
        .update(subscriptions)
        .set({ status: "cancelled", cancelledAt: new Date(), cancelReason: parsed.data.reason })
        .where(eq(subscriptions.id, current.id));
      await audit(tx, {
        orgId: org.id,
        actorId: userId,
        action: "subscription.cancel",
        entity: "subscription",
        entityId: current.id,
        diff: { reason: parsed.data.reason },
      });
      return { ok: true as const, memberId: current.memberId };
    });

    if (!result.ok) return { ok: false, error: result.error };
    revalidate(orgSlug, result.memberId);
    return { ok: true, data: undefined };
  } catch (e) {
    return fail(e);
  }
}
