import { TZDate } from "@date-fns/tz";
import { endOfMonth, startOfMonth, subMonths } from "date-fns";
import { and, asc, count, eq, gte, isNull, lte, sum } from "drizzle-orm";
import { members, payments, plans, subscriptions } from "@/db/schema";
import { addDaysISO, DEFAULT_TZ, todayISO } from "@/lib/dates";
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

export type PaymentMethodSummary = {
  method: "cash" | "transfer" | "card" | "other";
  count: number;
  totalCents: number;
};

export type MonthlyRevenue = {
  key: string;
  label: string;
  totalCents: number;
  count: number;
};

export type PlanPopularity = {
  id: string;
  name: string;
  color: string;
  activeCount: number;
  priceCents: number;
};

export type FullReportsData = {
  kpis: DashboardKpis;
  monthlyRevenue: MonthlyRevenue[];
  byMethod: PaymentMethodSummary[];
  plansPopularity: PlanPopularity[];
  membersTotal: number;
  membersActive: number;
  totalCollectedAllTime: number;
};

export async function getDetailedReportsData(orgId: string): Promise<FullReportsData> {
  const kpis = await getDashboardKpis(orgId);

  return withTenant(orgId, async (tx) => {
    // 1. Ingresos por método de pago (histórico completados)
    const methodRows = await tx
      .select({
        method: payments.method,
        total: sum(payments.amountCents),
        count: count(payments.id),
      })
      .from(payments)
      .where(
        and(
          eq(payments.orgId, orgId),
          isNull(payments.deletedAt),
          eq(payments.status, "completed"),
        ),
      )
      .groupBy(payments.method);

    const byMethod: PaymentMethodSummary[] = methodRows.map((r) => ({
      method: r.method,
      count: Number(r.count),
      totalCents: Number(r.total ?? 0),
    }));

    const totalCollectedAllTime = byMethod.reduce((acc, m) => acc + m.totalCents, 0);

    // 2. Histórico mensual de los últimos 6 meses
    const now = new TZDate(Date.now(), DEFAULT_TZ);
    const monthFormatter = new Intl.DateTimeFormat("es-CO", { month: "short", year: "numeric" });
    const monthlyRevenue: MonthlyRevenue[] = [];

    for (let i = 5; i >= 0; i--) {
      const monthDate = subMonths(now, i);
      const from = startOfMonth(monthDate);
      const to = endOfMonth(monthDate);

      const [res] = await tx
        .select({
          total: sum(payments.amountCents),
          count: count(payments.id),
        })
        .from(payments)
        .where(
          and(
            eq(payments.orgId, orgId),
            isNull(payments.deletedAt),
            eq(payments.status, "completed"),
            gte(payments.paidAt, from),
            lte(payments.paidAt, to),
          ),
        );

      const rawLabel = monthFormatter.format(monthDate);
      const label = rawLabel.charAt(0).toUpperCase() + rawLabel.slice(1);
      const key = `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, "0")}`;

      monthlyRevenue.push({
        key,
        label,
        totalCents: Number(res?.total ?? 0),
        count: Number(res?.count ?? 0),
      });
    }

    // 3. Distribución de planes activos
    const orgPlans = await tx
      .select()
      .from(plans)
      .where(and(eq(plans.orgId, orgId), isNull(plans.deletedAt)))
      .orderBy(asc(plans.sortOrder), asc(plans.name));

    const activeSubsByPlan = await tx
      .select({
        planId: subscriptions.planId,
        count: count(subscriptions.id),
      })
      .from(subscriptions)
      .where(
        and(
          eq(subscriptions.orgId, orgId),
          isNull(subscriptions.deletedAt),
          eq(subscriptions.status, "active"),
        ),
      )
      .groupBy(subscriptions.planId);

    const activeSubsMap = new Map<string, number>();
    for (const s of activeSubsByPlan) {
      activeSubsMap.set(s.planId, Number(s.count));
    }

    const plansPopularity: PlanPopularity[] = orgPlans.map((p) => ({
      id: p.id,
      name: p.name,
      color: p.color,
      priceCents: p.priceCents,
      activeCount: activeSubsMap.get(p.id) ?? 0,
    }));

    // 4. Totales de socios
    const [membersTotalRes, membersActiveRes] = await Promise.all([
      tx
        .select({ count: count() })
        .from(members)
        .where(and(eq(members.orgId, orgId), isNull(members.deletedAt))),
      tx
        .select({ count: count() })
        .from(members)
        .where(
          and(eq(members.orgId, orgId), isNull(members.deletedAt), eq(members.status, "active")),
        ),
    ]);

    return {
      kpis,
      monthlyRevenue,
      byMethod,
      plansPopularity,
      membersTotal: Number(membersTotalRes[0]?.count ?? 0),
      membersActive: Number(membersActiveRes[0]?.count ?? 0),
      totalCollectedAllTime,
    };
  });
}
