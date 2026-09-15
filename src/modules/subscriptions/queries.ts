import { and, count, desc, eq, gte, ilike, inArray, isNull, lt, lte, or, sql } from "drizzle-orm";
import {
  members,
  orgSettings,
  plans,
  subscriptions,
  type Plan,
  type Subscription,
} from "@/db/schema";
import { todayISO } from "@/lib/dates";
import { withTenant } from "@/lib/tenant";
import type { PickedMember } from "@/modules/members/picker";
import { deriveStatus, EXPIRING_SOON_DAYS, type DerivedStatus } from "./rules";
import { listSubscriptionsSchema, type ListSubscriptionsInput } from "./schema";

export type SubscriptionRow = Subscription & {
  derived: DerivedStatus;
  member: { id: string; firstName: string; lastName: string; documentNumber: string };
  plan: { id: string; name: string; color: string };
};

export type SubscriptionListResult = {
  rows: SubscriptionRow[];
  total: number;
  page: number;
  pageSize: number;
  counts: Record<"active" | "expiring" | "expired" | "frozen" | "cancelled", number>;
};

async function getGraceDays(orgId: string): Promise<number> {
  return withTenant(orgId, async (tx) => {
    const [row] = await tx
      .select({ graceDays: orgSettings.graceDays })
      .from(orgSettings)
      .where(eq(orgSettings.orgId, orgId))
      .limit(1);
    return row?.graceDays ?? 3;
  });
}

function addDaysISO(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export async function listSubscriptions(
  orgId: string,
  input: ListSubscriptionsInput,
): Promise<SubscriptionListResult> {
  const { filter, planId, q, page, pageSize } = listSubscriptionsSchema.parse(input);
  const today = todayISO();
  const graceDays = await getGraceDays(orgId);
  const soon = addDaysISO(today, EXPIRING_SOON_DAYS);

  const filterWhere = (() => {
    switch (filter) {
      case "active":
        return and(eq(subscriptions.status, "active"), gte(subscriptions.endDate, today));
      case "expiring":
        return and(
          eq(subscriptions.status, "active"),
          gte(subscriptions.endDate, today),
          lte(subscriptions.endDate, soon),
        );
      case "expired":
        return or(
          eq(subscriptions.status, "expired"),
          and(eq(subscriptions.status, "active"), lt(subscriptions.endDate, today)),
        );
      case "frozen":
        return eq(subscriptions.status, "frozen");
      case "cancelled":
        return eq(subscriptions.status, "cancelled");
      default:
        return undefined;
    }
  })();

  const searchWhere = q
    ? or(
        ilike(members.firstName, `%${q}%`),
        ilike(members.lastName, `%${q}%`),
        ilike(members.documentNumber, `%${q}%`),
        ilike(sql`${members.firstName} || ' ' || ${members.lastName}`, `%${q}%`),
      )
    : undefined;

  const where = and(
    eq(subscriptions.orgId, orgId),
    isNull(subscriptions.deletedAt),
    filterWhere,
    planId ? eq(subscriptions.planId, planId) : undefined,
    searchWhere,
  );

  return withTenant(orgId, async (tx) => {
    const [rows, [{ total }], countRows] = await Promise.all([
      tx
        .select({ sub: subscriptions, member: members, plan: plans })
        .from(subscriptions)
        .innerJoin(members, eq(members.id, subscriptions.memberId))
        .innerJoin(plans, eq(plans.id, subscriptions.planId))
        .where(where)
        .orderBy(desc(subscriptions.createdAt))
        .limit(pageSize)
        .offset((page - 1) * pageSize),
      tx
        .select({ total: count() })
        .from(subscriptions)
        .innerJoin(members, eq(members.id, subscriptions.memberId))
        .where(where),
      tx
        .select({ status: subscriptions.status, endDate: subscriptions.endDate, n: count() })
        .from(subscriptions)
        .where(and(eq(subscriptions.orgId, orgId), isNull(subscriptions.deletedAt)))
        .groupBy(subscriptions.status, subscriptions.endDate),
    ]);

    const counts = { active: 0, expiring: 0, expired: 0, frozen: 0, cancelled: 0 };
    for (const c of countRows) {
      if (c.status === "frozen") counts.frozen += c.n;
      else if (c.status === "cancelled") counts.cancelled += c.n;
      else if (c.status === "expired" || c.endDate < today) counts.expired += c.n;
      else {
        counts.active += c.n;
        if (c.endDate <= soon) counts.expiring += c.n;
      }
    }

    return {
      rows: rows.map((r) => ({
        ...r.sub,
        derived: deriveStatus(r.sub, graceDays, today),
        member: {
          id: r.member.id,
          firstName: r.member.firstName,
          lastName: r.member.lastName,
          documentNumber: r.member.documentNumber,
        },
        plan: { id: r.plan.id, name: r.plan.name, color: r.plan.color },
      })),
      total,
      page,
      pageSize,
      counts,
    };
  });
}

export async function getActiveSubscriptionForMember(
  orgId: string,
  memberId: string,
): Promise<(Subscription & { plan: Plan; derived: DerivedStatus }) | null> {
  const today = todayISO();
  const graceDays = await getGraceDays(orgId);
  return withTenant(orgId, async (tx) => {
    const [row] = await tx
      .select({ sub: subscriptions, plan: plans })
      .from(subscriptions)
      .innerJoin(plans, eq(plans.id, subscriptions.planId))
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
    if (!row) return null;
    return { ...row.sub, plan: row.plan, derived: deriveStatus(row.sub, graceDays, today) };
  });
}

export async function getSubscription(
  orgId: string,
  subscriptionId: string,
): Promise<(Subscription & { plan: Plan }) | null> {
  return withTenant(orgId, async (tx) => {
    const [row] = await tx
      .select({ sub: subscriptions, plan: plans })
      .from(subscriptions)
      .innerJoin(plans, eq(plans.id, subscriptions.planId))
      .where(and(eq(subscriptions.id, subscriptionId), eq(subscriptions.orgId, orgId)))
      .limit(1);
    return row ? { ...row.sub, plan: row.plan } : null;
  });
}

export async function getMemberPick(orgId: string, memberId: string): Promise<PickedMember | null> {
  return withTenant(orgId, async (tx) => {
    const [row] = await tx
      .select({
        id: members.id,
        firstName: members.firstName,
        lastName: members.lastName,
        documentType: members.documentType,
        documentNumber: members.documentNumber,
        status: members.status,
      })
      .from(members)
      .where(and(eq(members.id, memberId), eq(members.orgId, orgId), isNull(members.deletedAt)))
      .limit(1);
    return row ?? null;
  });
}
