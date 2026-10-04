import { TZDate } from "@date-fns/tz";
import { endOfDay, startOfDay } from "date-fns";
import { and, count, desc, eq, gte, isNull, lte } from "drizzle-orm";
import { checkins, members, plans, subscriptions, user } from "@/db/schema";
import { DEFAULT_TZ } from "@/lib/dates";
import { withTenant } from "@/lib/tenant";

export type RecentCheckinRow = {
  id: string;
  createdAt: Date;
  status: "granted" | "rejected";
  reason: string;
  memberId: string;
  memberFirstName: string;
  memberLastName: string;
  memberDocument: string;
  memberPhotoUrl: string | null;
  planName: string | null;
  registeredByName: string | null;
};

export async function listRecentCheckins(orgId: string, limit = 40): Promise<RecentCheckinRow[]> {
  return withTenant(orgId, async (tx) => {
    const rows = await tx
      .select({
        id: checkins.id,
        createdAt: checkins.createdAt,
        status: checkins.status,
        reason: checkins.reason,
        memberId: members.id,
        memberFirstName: members.firstName,
        memberLastName: members.lastName,
        memberDocument: members.documentNumber,
        memberPhotoUrl: members.photoUrl,
        planName: plans.name,
        registeredByName: user.name,
      })
      .from(checkins)
      .innerJoin(members, eq(members.id, checkins.memberId))
      .leftJoin(subscriptions, eq(subscriptions.id, checkins.subscriptionId))
      .leftJoin(plans, eq(plans.id, subscriptions.planId))
      .leftJoin(user, eq(user.id, checkins.registeredBy))
      .where(and(eq(checkins.orgId, orgId), isNull(checkins.deletedAt)))
      .orderBy(desc(checkins.createdAt))
      .limit(limit);

    return rows;
  });
}

export type CheckinStatsToday = {
  total: number;
  granted: number;
  rejected: number;
};

export async function getCheckinStatsToday(orgId: string): Promise<CheckinStatsToday> {
  const now = new TZDate(Date.now(), DEFAULT_TZ);
  const from = startOfDay(now);
  const to = endOfDay(now);

  return withTenant(orgId, async (tx) => {
    const [grantedRes, rejectedRes] = await Promise.all([
      tx
        .select({ count: count() })
        .from(checkins)
        .where(
          and(
            eq(checkins.orgId, orgId),
            isNull(checkins.deletedAt),
            eq(checkins.status, "granted"),
            gte(checkins.createdAt, from),
            lte(checkins.createdAt, to),
          ),
        ),
      tx
        .select({ count: count() })
        .from(checkins)
        .where(
          and(
            eq(checkins.orgId, orgId),
            isNull(checkins.deletedAt),
            eq(checkins.status, "rejected"),
            gte(checkins.createdAt, from),
            lte(checkins.createdAt, to),
          ),
        ),
    ]);

    const granted = Number(grantedRes[0]?.count ?? 0);
    const rejected = Number(rejectedRes[0]?.count ?? 0);

    return {
      total: granted + rejected,
      granted,
      rejected,
    };
  });
}
