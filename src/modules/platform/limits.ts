import { and, count, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { members, branches, member } from "@/db/schema";
import { getCurrentSubscription } from "./queries";
import { withTenant } from "@/lib/tenant";

export type LimitCheck = { allowed: true } | { allowed: false; reason: string };

export async function checkMemberLimit(orgId: string): Promise<LimitCheck> {
  const sub = await getCurrentSubscription(orgId);
  if (!sub?.plan?.maxMembers) return { allowed: true };

  const [{ n }] = await withTenant(orgId, (tx) =>
    tx
      .select({ n: count() })
      .from(members)
      .where(and(eq(members.orgId, orgId), isNull(members.deletedAt))),
  );

  if (n >= sub.plan.maxMembers) {
    return {
      allowed: false,
      reason: `Tu plan "${sub.plan.name}" permite máximo ${sub.plan.maxMembers} socios. Contacta al equipo de AdminFit para ampliar tu plan.`,
    };
  }
  return { allowed: true };
}

export async function checkBranchLimit(orgId: string): Promise<LimitCheck> {
  const sub = await getCurrentSubscription(orgId);
  if (!sub?.plan?.maxBranches) return { allowed: true };

  const [{ n }] = await withTenant(orgId, (tx) =>
    tx
      .select({ n: count() })
      .from(branches)
      .where(and(eq(branches.orgId, orgId), isNull(branches.deletedAt))),
  );

  if (n >= sub.plan.maxBranches) {
    return {
      allowed: false,
      reason: `Tu plan "${sub.plan.name}" permite máximo ${sub.plan.maxBranches} sedes. Contacta al equipo de AdminFit para ampliar tu plan.`,
    };
  }
  return { allowed: true };
}

export async function checkStaffLimit(orgId: string): Promise<LimitCheck> {
  const sub = await getCurrentSubscription(orgId);
  if (!sub?.plan?.maxStaff) return { allowed: true };

  const [{ n }] = await db
    .select({ n: count() })
    .from(member)
    .where(eq(member.organizationId, orgId));

  if (n >= sub.plan.maxStaff) {
    return {
      allowed: false,
      reason: `Tu plan "${sub.plan.name}" permite máximo ${sub.plan.maxStaff} usuarios de equipo. Contacta al equipo de AdminFit para ampliar tu plan.`,
    };
  }
  return { allowed: true };
}
