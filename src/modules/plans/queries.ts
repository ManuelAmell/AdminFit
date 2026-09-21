import { and, asc, count, eq, isNull } from "drizzle-orm";
import { plans, subscriptions, type Plan } from "@/db/schema";
import { withTenant } from "@/lib/tenant";

export type PlanWithUsage = Plan & { subscriptionCount: number };

export async function listPlans(orgId: string): Promise<PlanWithUsage[]> {
  return withTenant(orgId, async (tx) => {
    const rows = await tx
      .select({
        plan: plans,
        subscriptionCount: count(subscriptions.id),
      })
      .from(plans)
      .leftJoin(subscriptions, eq(subscriptions.planId, plans.id))
      .where(and(eq(plans.orgId, orgId), isNull(plans.deletedAt)))
      .groupBy(plans.id)
      .orderBy(asc(plans.sortOrder), asc(plans.createdAt));
    return rows.map((r) => ({ ...r.plan, subscriptionCount: r.subscriptionCount }));
  });
}

export async function listActivePlans(orgId: string): Promise<Plan[]> {
  return withTenant(orgId, (tx) =>
    tx
      .select()
      .from(plans)
      .where(and(eq(plans.orgId, orgId), eq(plans.isActive, true), isNull(plans.deletedAt)))
      .orderBy(asc(plans.sortOrder), asc(plans.createdAt)),
  );
}

export async function getPlan(orgId: string, planId: string): Promise<Plan | null> {
  return withTenant(orgId, async (tx) => {
    const [row] = await tx
      .select()
      .from(plans)
      .where(and(eq(plans.orgId, orgId), eq(plans.id, planId), isNull(plans.deletedAt)))
      .limit(1);
    return row ?? null;
  });
}
