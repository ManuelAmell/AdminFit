import { TZDate } from "@date-fns/tz";
import { format } from "date-fns";
import { and, asc, count, desc, eq, gte, isNull, lte, ne, sql, sum } from "drizzle-orm";
import { auditLog, members, organization, payments, plans, subscriptions } from "@/db/schema";
import { addDaysISO, DEFAULT_TZ, todayISO } from "@/lib/dates";
import { withTenant } from "@/lib/tenant";
import type { PaymentMethod } from "@/modules/payments/constants";
import { getCompletedPaymentsTotal } from "@/modules/payments/queries";
import { paymentFiltersSchema } from "@/modules/payments/schema";
import { getSubscriptionCounts } from "@/modules/subscriptions/queries";
import { EXPIRING_SOON_DAYS } from "@/modules/subscriptions/rules";
import type { ReportExportData } from "./csv";
import { resolveReportDateRange, type ReportFilters, type ResolvedReportDateRange } from "./schema";

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

// -------------------------------------------------------------
// ANALÍTICA Y REPORTES DEL TENANT (/app/[orgSlug]/reports)
// -------------------------------------------------------------

export type PlanRevenueItem = {
  planId: string;
  planName: string;
  count: number;
  totalCents: number;
  percentage: number;
};

export type MethodRevenueItem = {
  method: PaymentMethod;
  count: number;
  totalCents: number;
  percentage: number;
};

export type TenantReportSummary = {
  totalRevenueCents: number;
  totalPayments: number;
  newMembersCount: number;
  renewalsCount: number;
  expirationsCount: number;
};

export type TenantReportData = {
  dateRange: ResolvedReportDateRange;
  summary: TenantReportSummary;
  byPlan: PlanRevenueItem[];
  byMethod: MethodRevenueItem[];
};

export function computePercentages<T extends { totalCents: number }>(
  items: T[],
  grandTotalCents: number,
): Array<T & { percentage: number }> {
  if (grandTotalCents <= 0) {
    return items.map((item) => ({ ...item, percentage: 0 }));
  }
  return items.map((item) => ({
    ...item,
    percentage: Math.round((item.totalCents / grandTotalCents) * 1000) / 10,
  }));
}

export async function getTenantReport(
  orgId: string,
  filters: ReportFilters,
): Promise<TenantReportData> {
  const dateRange = resolveReportDateRange(filters);

  return withTenant(orgId, async (tx) => {
    // 1. Ingresos por método de pago
    const methodRows = await tx
      .select({
        method: payments.method,
        count: count(payments.id),
        totalCents: sum(payments.amountCents).mapWith(Number),
      })
      .from(payments)
      .where(
        and(
          eq(payments.orgId, orgId),
          isNull(payments.deletedAt),
          eq(payments.status, "completed"),
          gte(payments.paidAt, dateRange.from),
          lte(payments.paidAt, dateRange.to),
        ),
      )
      .groupBy(payments.method);

    // 2. Ingresos por plan (incluyendo ventas directas / sin plan)
    const planRows = await tx
      .select({
        planId: sql<string>`COALESCE(${plans.id}::text, 'unassigned')`,
        planName: sql<string>`COALESCE(${plans.name}, 'Sin plan / Venta directa')`,
        count: count(payments.id),
        totalCents: sum(payments.amountCents).mapWith(Number),
      })
      .from(payments)
      .leftJoin(subscriptions, eq(subscriptions.id, payments.subscriptionId))
      .leftJoin(plans, eq(plans.id, subscriptions.planId))
      .where(
        and(
          eq(payments.orgId, orgId),
          isNull(payments.deletedAt),
          eq(payments.status, "completed"),
          gte(payments.paidAt, dateRange.from),
          lte(payments.paidAt, dateRange.to),
        ),
      )
      .groupBy(plans.id, plans.name)
      .orderBy(desc(sql`SUM(${payments.amountCents})`));

    // 3. Altas de socios (creados en el periodo)
    const [altasRow] = await tx
      .select({ count: count() })
      .from(members)
      .where(
        and(
          eq(members.orgId, orgId),
          isNull(members.deletedAt),
          gte(members.createdAt, dateRange.from),
          lte(members.createdAt, dateRange.to),
        ),
      );

    // 4. Renovaciones en el periodo (vía audit_log)
    const [renewalsRow] = await tx
      .select({ count: count() })
      .from(auditLog)
      .where(
        and(
          eq(auditLog.orgId, orgId),
          eq(auditLog.action, "subscription.renew"),
          gte(auditLog.createdAt, dateRange.from),
          lte(auditLog.createdAt, dateRange.to),
        ),
      );

    // 5. Vencimientos en el periodo (fecha fin en el rango, activas o vencidas, no canceladas)
    const [expirationsRow] = await tx
      .select({ count: count() })
      .from(subscriptions)
      .where(
        and(
          eq(subscriptions.orgId, orgId),
          isNull(subscriptions.deletedAt),
          ne(subscriptions.status, "cancelled"),
          gte(subscriptions.endDate, dateRange.fromISO),
          lte(subscriptions.endDate, dateRange.toISO),
        ),
      );

    const totalRevenueCents = methodRows.reduce((acc, row) => acc + (row.totalCents || 0), 0);
    const totalPayments = methodRows.reduce((acc, row) => acc + row.count, 0);

    const byMethod = computePercentages(
      methodRows.map((r) => ({
        method: r.method,
        count: r.count,
        totalCents: r.totalCents || 0,
      })),
      totalRevenueCents,
    );

    const byPlan = computePercentages(
      planRows.map((r) => ({
        planId: r.planId,
        planName: r.planName,
        count: r.count,
        totalCents: r.totalCents || 0,
      })),
      totalRevenueCents,
    );

    return {
      dateRange,
      summary: {
        totalRevenueCents,
        totalPayments,
        newMembersCount: altasRow?.count ?? 0,
        renewalsCount: renewalsRow?.count ?? 0,
        expirationsCount: expirationsRow?.count ?? 0,
      },
      byPlan,
      byMethod,
    };
  });
}

export async function getReportExportData(
  orgId: string,
  filters: ReportFilters,
): Promise<ReportExportData> {
  const report = await getTenantReport(orgId, filters);

  return withTenant(orgId, async (tx) => {
    const [org] = await tx
      .select({ name: organization.name })
      .from(organization)
      .where(eq(organization.id, orgId))
      .limit(1);

    const paymentRows = await tx
      .select({
        receiptNumber: payments.receiptNumber,
        paidAt: payments.paidAt,
        method: payments.method,
        reference: payments.reference,
        amountCents: payments.amountCents,
        memberDocument: members.documentNumber,
        memberFirstName: members.firstName,
        memberLastName: members.lastName,
        planName: sql<string>`COALESCE(${plans.name}, 'Sin plan / Venta directa')`,
      })
      .from(payments)
      .innerJoin(members, eq(members.id, payments.memberId))
      .leftJoin(subscriptions, eq(subscriptions.id, payments.subscriptionId))
      .leftJoin(plans, eq(plans.id, subscriptions.planId))
      .where(
        and(
          eq(payments.orgId, orgId),
          isNull(payments.deletedAt),
          eq(payments.status, "completed"),
          gte(payments.paidAt, report.dateRange.from),
          lte(payments.paidAt, report.dateRange.to),
        ),
      )
      .orderBy(desc(payments.paidAt), desc(payments.receiptNumber));

    const paymentsDetail = paymentRows.map((p) => {
      const tzDate = new TZDate(p.paidAt, DEFAULT_TZ);
      const paidAtBogota = format(tzDate, "yyyy-MM-dd HH:mm");
      return {
        receiptNumber: p.receiptNumber,
        paidAtBogota,
        memberDocument: p.memberDocument,
        memberName: `${p.memberFirstName} ${p.memberLastName}`.trim(),
        planName: p.planName,
        method: p.method,
        reference: p.reference,
        amountCents: p.amountCents,
      };
    });

    return {
      orgName: org?.name ?? "Gimnasio",
      dateRange: {
        fromISO: report.dateRange.fromISO,
        toISO: report.dateRange.toISO,
        preset: filters.range,
      },
      summary: report.summary,
      byPlan: report.byPlan,
      byMethod: report.byMethod,
      paymentsDetail,
    };
  });
}
