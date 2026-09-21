import { and, asc, eq, gte, isNull, lte } from "drizzle-orm";
import { members, plans, subscriptions } from "@/db/schema";
import { addDaysISO, todayISO } from "@/lib/dates";
import { withTenant } from "@/lib/tenant";
import { getCompletedPaymentsTotal } from "@/modules/payments/queries";
import { paymentFiltersSchema } from "@/modules/payments/schema";
import { getSubscriptionCounts } from "@/modules/subscriptions/queries";
import { EXPIRING_SOON_DAYS } from "@/modules/subscriptions/rules";

export type DashboardKpis = {
  counts: Record<"active" | "expiring" | "expired" | "frozen" | "cancelled", number>;
  revenueCentsThisMonth: number;
};

export async function getDashboardKpis(orgId: string): Promise<DashboardKpis> {
  const [counts, revenueCentsThisMonth] = await Promise.all([
    getSubscriptionCounts(orgId),
    getCompletedPaymentsTotal(orgId, paymentFiltersSchema.parse({ range: "month" })),
  ]);
  return { counts, revenueCentsThisMonth };
}

export type UpcomingExpiration = {
  id: string;
  endDate: string;
  memberId: string;
  firstName: string;
  lastName: string;
  planName: string;
};

// Membresías activas que vencen dentro de EXPIRING_SOON_DAYS, para el dashboard.
export async function listUpcomingExpirations(
  orgId: string,
  limit = 8,
): Promise<UpcomingExpiration[]> {
  const today = todayISO();
  const soon = addDaysISO(today, EXPIRING_SOON_DAYS);
  return withTenant(orgId, (tx) =>
    tx
      .select({
        id: subscriptions.id,
        endDate: subscriptions.endDate,
        memberId: members.id,
        firstName: members.firstName,
        lastName: members.lastName,
        planName: plans.name,
      })
      .from(subscriptions)
      .innerJoin(members, eq(members.id, subscriptions.memberId))
      .innerJoin(plans, eq(plans.id, subscriptions.planId))
      .where(
        and(
          eq(subscriptions.orgId, orgId),
          isNull(subscriptions.deletedAt),
          eq(subscriptions.status, "active"),
          gte(subscriptions.endDate, today),
          lte(subscriptions.endDate, soon),
        ),
      )
      .orderBy(asc(subscriptions.endDate))
      .limit(limit),
  );
}
