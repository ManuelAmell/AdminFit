import { and, asc, eq, gte, isNull, lte, ne, sql } from "drizzle-orm";
import { expenses, payments, plans, members, subscriptions } from "@/db/schema";
import {
  addDaysISO,
  DEFAULT_TZ,
  monthRange,
  previousMonthISO,
  resolveDateRange,
  todayISO,
  type DateRangeFilter,
} from "@/lib/dates";
import { withTenant } from "@/lib/tenant";
import type { ExpenseCategory } from "@/modules/expenses/constants";
import { getCompletedPaymentsTotal, getTotalDebtCents } from "@/modules/payments/queries";
import type { PaymentConcept, PaymentMethod } from "@/modules/payments/constants";
import { paymentFiltersSchema } from "@/modules/payments/schema";
import { getSubscriptionCounts } from "@/modules/subscriptions/queries";
import { EXPIRING_SOON_DAYS } from "@/modules/subscriptions/rules";

export type DashboardKpis = {
  counts: Record<"active" | "expiring" | "expired" | "frozen" | "cancelled", number>;
  revenueCentsThisMonth: number;
  expenseCentsThisMonth: number;
  profitCentsThisMonth: number;
  debtCents: number;
};

export async function getDashboardKpis(orgId: string): Promise<DashboardKpis> {
  const [counts, revenueCentsThisMonth, debtCents, [thisMonth]] = await Promise.all([
    getSubscriptionCounts(orgId),
    getCompletedPaymentsTotal(orgId, paymentFiltersSchema.parse({ range: "month" })),
    getTotalDebtCents(orgId),
    getIncomeVsExpenses(orgId, 1),
  ]);
  const expenseCentsThisMonth = thisMonth?.expenseCents ?? 0;
  return {
    counts,
    revenueCentsThisMonth,
    expenseCentsThisMonth,
    profitCentsThisMonth: revenueCentsThisMonth - expenseCentsThisMonth,
    debtCents,
  };
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

// ── Gráficas del dashboard "Negocio" (Fase 5.7) ──────────────────────────────────────
// Todas calculan en TZ Bogotá (America/Bogota) para que "hoy"/"este mes" coincida con lo
// que ve el usuario, no con UTC. Los días/meses sin datos se rellenan en JS: Postgres solo
// devuelve las filas que existen.

export type RevenuePoint = { date: string; cents: number };

// Serie diaria de ingresos completados, últimos `days` días (incluye hoy).
export async function getRevenueSeries(orgId: string, days = 14): Promise<RevenuePoint[]> {
  return withTenant(orgId, async (tx) => {
    const rows = await tx
      .select({
        day: sql<string>`to_char(${payments.paidAt} at time zone ${DEFAULT_TZ}, 'YYYY-MM-DD')`,
        cents: sql<number>`coalesce(sum(${payments.amountCents}), 0)`.mapWith(Number),
      })
      .from(payments)
      .where(
        and(
          eq(payments.orgId, orgId),
          isNull(payments.deletedAt),
          eq(payments.status, "completed"),
          gte(payments.paidAt, new Date(Date.now() - days * 24 * 60 * 60 * 1000)),
        ),
      )
      .groupBy(sql`1`);
    const byDay = new Map(rows.map((r) => [r.day, r.cents]));
    const today = todayISO();
    const out: RevenuePoint[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = addDaysISO(today, -i);
      out.push({ date: d, cents: byDay.get(d) ?? 0 });
    }
    return out;
  });
}

export type MonthlyFinancials = { month: string; incomeCents: number; expenseCents: number };

// Ingresos vs. gastos completados, últimos `months` meses (incluye el actual).
export async function getIncomeVsExpenses(orgId: string, months = 6): Promise<MonthlyFinancials[]> {
  const since = new Date();
  since.setMonth(since.getMonth() - (months - 1), 1);
  since.setHours(0, 0, 0, 0);

  return withTenant(orgId, async (tx) => {
    const [incomeRows, expenseRows] = await Promise.all([
      tx
        .select({
          month: sql<string>`to_char(${payments.paidAt} at time zone ${DEFAULT_TZ}, 'YYYY-MM')`,
          cents: sql<number>`coalesce(sum(${payments.amountCents}), 0)`.mapWith(Number),
        })
        .from(payments)
        .where(
          and(
            eq(payments.orgId, orgId),
            isNull(payments.deletedAt),
            eq(payments.status, "completed"),
            gte(payments.paidAt, since),
          ),
        )
        .groupBy(sql`1`),
      tx
        .select({
          month: sql<string>`to_char(${expenses.spentAt} at time zone ${DEFAULT_TZ}, 'YYYY-MM')`,
          cents: sql<number>`coalesce(sum(${expenses.amountCents}), 0)`.mapWith(Number),
        })
        .from(expenses)
        .where(
          and(
            eq(expenses.orgId, orgId),
            isNull(expenses.deletedAt),
            eq(expenses.status, "completed"),
            gte(expenses.spentAt, since),
          ),
        )
        .groupBy(sql`1`),
    ]);
    const income = new Map(incomeRows.map((r) => [r.month, r.cents]));
    const expense = new Map(expenseRows.map((r) => [r.month, r.cents]));

    const out: MonthlyFinancials[] = [];
    const cursor = new Date(since);
    for (let i = 0; i < months; i++) {
      const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}`;
      out.push({
        month: key,
        incomeCents: income.get(key) ?? 0,
        expenseCents: expense.get(key) ?? 0,
      });
      cursor.setMonth(cursor.getMonth() + 1);
    }
    return out;
  });
}

export type ExpenseSlice = { category: ExpenseCategory; cents: number };

// Gastos completados por categoría en el periodo. `excludePayroll`: igual que en
// listExpenses — sin expense.readPayroll la nómina no debe salir del query, no solo
// ocultarse en la UI (Fase 5 slice 0).
export async function getExpenseBreakdown(
  orgId: string,
  range: DateRangeFilter,
  excludePayroll: boolean,
): Promise<ExpenseSlice[]> {
  const { from, to } = resolveDateRange(range);
  return withTenant(orgId, async (tx) => {
    const rows = await tx
      .select({
        category: expenses.category,
        cents: sql<number>`coalesce(sum(${expenses.amountCents}), 0)`.mapWith(Number),
      })
      .from(expenses)
      .where(
        and(
          eq(expenses.orgId, orgId),
          isNull(expenses.deletedAt),
          eq(expenses.status, "completed"),
          from ? gte(expenses.spentAt, from) : undefined,
          to ? lte(expenses.spentAt, to) : undefined,
          excludePayroll ? ne(expenses.category, "payroll") : undefined,
        ),
      )
      .groupBy(expenses.category)
      .orderBy(sql`2 desc`);
    return rows;
  });
}

export type PlanSlice = { planId: string; planName: string; cents: number; n: number };

// Ingresos y cantidad de pagos por plan (solo pagos ligados a una membresía concreta —
// un abono sin membresía o una venta rápida no tiene plan que atribuirle).
export async function getPlanPerformance(
  orgId: string,
  range: DateRangeFilter,
): Promise<PlanSlice[]> {
  const { from, to } = resolveDateRange(range);
  return withTenant(orgId, async (tx) => {
    const rows = await tx
      .select({
        planId: plans.id,
        planName: plans.name,
        cents: sql<number>`coalesce(sum(${payments.amountCents}), 0)`.mapWith(Number),
        n: sql<number>`count(*)`.mapWith(Number),
      })
      .from(payments)
      .innerJoin(subscriptions, eq(subscriptions.id, payments.subscriptionId))
      .innerJoin(plans, eq(plans.id, subscriptions.planId))
      .where(
        and(
          eq(payments.orgId, orgId),
          isNull(payments.deletedAt),
          eq(payments.status, "completed"),
          from ? gte(payments.paidAt, from) : undefined,
          to ? lte(payments.paidAt, to) : undefined,
        ),
      )
      .groupBy(plans.id, plans.name)
      .orderBy(sql`3 desc`)
      .limit(8);
    return rows;
  });
}

export type MonthlySummary = {
  month: string;
  incomeByConcept: { concept: PaymentConcept; cents: number }[];
  incomeByMethod: { method: PaymentMethod; cents: number }[];
  incomeTotal: number;
  expensesByCategory: ExpenseSlice[];
  expensesTotal: number;
  profitCents: number;
  previous: { incomeTotal: number; expensesTotal: number; profitCents: number };
};

// Resumen del mes elegido (Fase 5.7b) — a diferencia de las gráficas del dashboard
// ("últimos N días/meses" fijo), aquí el usuario elige cualquier mes calendario.
export async function getMonthlySummary(
  orgId: string,
  monthISO: string,
  excludePayroll: boolean,
): Promise<MonthlySummary> {
  const { from, to } = monthRange(monthISO);
  const prev = monthRange(previousMonthISO(monthISO));

  return withTenant(orgId, async (tx) => {
    const incomeWhere = (f: Date, t: Date) =>
      and(
        eq(payments.orgId, orgId),
        isNull(payments.deletedAt),
        eq(payments.status, "completed"),
        gte(payments.paidAt, f),
        lte(payments.paidAt, t),
      );
    const expenseWhere = (f: Date, t: Date) =>
      and(
        eq(expenses.orgId, orgId),
        isNull(expenses.deletedAt),
        eq(expenses.status, "completed"),
        gte(expenses.spentAt, f),
        lte(expenses.spentAt, t),
        excludePayroll ? ne(expenses.category, "payroll") : undefined,
      );

    const [byConcept, byMethod, byCategory, prevIncome, prevExpense] = await Promise.all([
      tx
        .select({
          concept: payments.concept,
          cents: sql<number>`coalesce(sum(${payments.amountCents}), 0)`.mapWith(Number),
        })
        .from(payments)
        .where(incomeWhere(from!, to!))
        .groupBy(payments.concept)
        .orderBy(sql`2 desc`),
      tx
        .select({
          method: payments.method,
          cents: sql<number>`coalesce(sum(${payments.amountCents}), 0)`.mapWith(Number),
        })
        .from(payments)
        .where(incomeWhere(from!, to!))
        .groupBy(payments.method)
        .orderBy(sql`2 desc`),
      tx
        .select({
          category: expenses.category,
          cents: sql<number>`coalesce(sum(${expenses.amountCents}), 0)`.mapWith(Number),
        })
        .from(expenses)
        .where(expenseWhere(from!, to!))
        .groupBy(expenses.category)
        .orderBy(sql`2 desc`),
      tx
        .select({ cents: sql<number>`coalesce(sum(${payments.amountCents}), 0)`.mapWith(Number) })
        .from(payments)
        .where(incomeWhere(prev.from!, prev.to!)),
      tx
        .select({ cents: sql<number>`coalesce(sum(${expenses.amountCents}), 0)`.mapWith(Number) })
        .from(expenses)
        .where(expenseWhere(prev.from!, prev.to!)),
    ]);

    const incomeTotal = byConcept.reduce((a, r) => a + r.cents, 0);
    const expensesTotal = byCategory.reduce((a, r) => a + r.cents, 0);
    const previousIncomeTotal = prevIncome[0]?.cents ?? 0;
    const previousExpensesTotal = prevExpense[0]?.cents ?? 0;

    return {
      month: monthISO,
      incomeByConcept: byConcept,
      incomeByMethod: byMethod,
      incomeTotal,
      expensesByCategory: byCategory,
      expensesTotal,
      profitCents: incomeTotal - expensesTotal,
      previous: {
        incomeTotal: previousIncomeTotal,
        expensesTotal: previousExpensesTotal,
        profitCents: previousIncomeTotal - previousExpensesTotal,
      },
    };
  });
}
