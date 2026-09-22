import { and, count, desc, eq, gte, isNull, lte, ne, sum } from "drizzle-orm";
import { branches, expenses, user } from "@/db/schema";
import { dayRange, resolveDateRange } from "@/lib/dates";
import { withTenant } from "@/lib/tenant";
import type { ExpenseFilters } from "./schema";

// `scope.recordedBy`: Recepción (sin expense.readAll) solo ve sus propios gastos.
// `scope.excludePayroll`: sin expense.readPayroll, la categoría nómina no sale ni en la
// lista ni en los totales — no solo se oculta en la UI (ver Fase 5 slice 0).
export type ExpenseScope = { recordedBy?: string; excludePayroll?: boolean };

function expenseConditions(orgId: string, filters: ExpenseFilters, scope: ExpenseScope) {
  const { from, to } = resolveDateRange(filters);
  return and(
    eq(expenses.orgId, orgId),
    isNull(expenses.deletedAt),
    from ? gte(expenses.spentAt, from) : undefined,
    to ? lte(expenses.spentAt, to) : undefined,
    filters.category ? eq(expenses.category, filters.category) : undefined,
    filters.status ? eq(expenses.status, filters.status) : undefined,
    scope.recordedBy ? eq(expenses.recordedBy, scope.recordedBy) : undefined,
    scope.excludePayroll ? ne(expenses.category, "payroll") : undefined,
  );
}

export async function listExpenses(
  orgId: string,
  filters: ExpenseFilters,
  scope: ExpenseScope = {},
) {
  return withTenant(orgId, async (tx) => {
    const where = expenseConditions(orgId, filters, scope);
    const offset = (filters.page - 1) * filters.pageSize;

    const [rows, [{ total }], [{ completedTotal }]] = await Promise.all([
      tx
        .select({
          id: expenses.id,
          category: expenses.category,
          description: expenses.description,
          amountCents: expenses.amountCents,
          method: expenses.method,
          status: expenses.status,
          spentAt: expenses.spentAt,
          branchName: branches.name,
          recordedByName: user.name,
        })
        .from(expenses)
        .leftJoin(branches, eq(branches.id, expenses.branchId))
        .leftJoin(user, eq(user.id, expenses.recordedBy))
        .where(where)
        .orderBy(desc(expenses.spentAt))
        .limit(filters.pageSize)
        .offset(offset),
      tx.select({ total: count() }).from(expenses).where(where),
      tx
        .select({ completedTotal: sum(expenses.amountCents).mapWith(Number) })
        .from(expenses)
        .where(and(where, eq(expenses.status, "completed"))),
    ]);

    return {
      rows,
      total,
      page: filters.page,
      pageSize: filters.pageSize,
      pageCount: Math.max(1, Math.ceil(total / filters.pageSize)),
      completedTotal: completedTotal ?? 0,
    };
  });
}

export async function getExpense(orgId: string, expenseId: string, scope: ExpenseScope = {}) {
  return withTenant(orgId, async (tx) => {
    const [row] = await tx
      .select({
        expense: expenses,
        branchName: branches.name,
        recordedByName: user.name,
      })
      .from(expenses)
      .leftJoin(branches, eq(branches.id, expenses.branchId))
      .leftJoin(user, eq(user.id, expenses.recordedBy))
      .where(
        and(
          eq(expenses.id, expenseId),
          isNull(expenses.deletedAt),
          scope.recordedBy ? eq(expenses.recordedBy, scope.recordedBy) : undefined,
        ),
      )
      .limit(1);
    if (!row) return null;

    let voidedByName: string | null = null;
    if (row.expense.voidedBy) {
      const [u] = await tx
        .select({ name: user.name })
        .from(user)
        .where(eq(user.id, row.expense.voidedBy))
        .limit(1);
      voidedByName = u?.name ?? null;
    }
    return { ...row, voidedByName };
  });
}

// Para el cierre de caja (Fase 5.6): gastos en efectivo del día, por sede.
export async function getCashExpensesTotal(
  orgId: string,
  dateISO: string,
  branchId: string | null,
) {
  const { from, to } = dayRange(dateISO);
  return withTenant(orgId, async (tx) => {
    const [row] = await tx
      .select({ total: sum(expenses.amountCents).mapWith(Number) })
      .from(expenses)
      .where(
        and(
          eq(expenses.orgId, orgId),
          isNull(expenses.deletedAt),
          eq(expenses.status, "completed"),
          eq(expenses.method, "cash"),
          gte(expenses.spentAt, from),
          lte(expenses.spentAt, to),
          branchId ? eq(expenses.branchId, branchId) : isNull(expenses.branchId),
        ),
      );
    return row?.total ?? 0;
  });
}
