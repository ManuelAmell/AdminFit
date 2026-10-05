import { and, asc, desc, eq, gte, inArray, isNotNull, isNull, lte, sql } from "drizzle-orm";
import { branches, cashClosures, expenses, payments, user } from "@/db/schema";
import { DEFAULT_TZ, dayRange } from "@/lib/dates";
import { withTenant } from "@/lib/tenant";
import type { PaymentMethod } from "@/modules/payments/constants";
import type { DayMovement } from "./analytics";
import { getCashExpensesTotal } from "@/modules/expenses/queries";
import { getCashClose } from "@/modules/payments/queries";

// Mismo truco que el índice único de la tabla: coalesce a un uuid fijo para tratar
// "sin sede" como una sola sede al buscar/guardar (ver drizzle/0005).
const NO_BRANCH = "00000000-0000-0000-0000-000000000000";
function branchExpr(branchId: string | null) {
  return branchId ?? NO_BRANCH;
}

export async function getCashClosure(orgId: string, dateISO: string, branchId: string | null) {
  return withTenant(orgId, async (tx) => {
    const [row] = await tx
      .select({
        closure: cashClosures,
        closedByName: user.name,
      })
      .from(cashClosures)
      .leftJoin(user, eq(user.id, cashClosures.closedBy))
      .where(
        and(
          eq(cashClosures.orgId, orgId),
          isNull(cashClosures.deletedAt),
          eq(sql`coalesce(${cashClosures.branchId}, ${NO_BRANCH}::uuid)`, branchExpr(branchId)),
          eq(cashClosures.businessDate, dateISO),
        ),
      )
      .limit(1);
    if (!row) return null;

    let reopenedByName: string | null = null;
    if (row.closure.reopenedBy) {
      const [u] = await tx
        .select({ name: user.name })
        .from(user)
        .where(eq(user.id, row.closure.reopenedBy))
        .limit(1);
      reopenedByName = u?.name ?? null;
    }
    return { ...row, reopenedByName };
  });
}

// Lo esperado en caja: base + efectivo cobrado - gastos en efectivo del día/sede. Sin
// filtrar por usuario (a diferencia de la vista de Recepción) — el cierre siempre suma
// TODO el efectivo; el arqueo ciego (Fase 5 slice 0) solo oculta la cifra en la UI, no
// cambia el cálculo.
export async function computeExpectedCashCents(
  orgId: string,
  dateISO: string,
  branchId: string | null,
  openingCashCents: number,
) {
  const [close, cashExpenses] = await Promise.all([
    getCashClose(orgId, dateISO, {}),
    getCashExpensesTotal(orgId, dateISO, branchId),
  ]);
  const cashSales = branchId
    ? close.completed
        .filter((p) => p.branchId === branchId && p.method === "cash")
        .reduce((a, p) => a + p.amountCents, 0)
    : (close.byMethod.find((m) => m.method === "cash")?.total ?? 0);
  return openingCashCents + cashSales - cashExpenses;
}

export async function listCashClosures(orgId: string, limit = 30) {
  return withTenant(orgId, (tx) =>
    tx
      .select({ closure: cashClosures, closedByName: user.name })
      .from(cashClosures)
      .leftJoin(user, eq(user.id, cashClosures.closedBy))
      .where(and(eq(cashClosures.orgId, orgId), isNull(cashClosures.deletedAt)))
      .orderBy(desc(cashClosures.businessDate))
      .limit(limit),
  );
}

// ── Centro de caja (Fase 6.A) ─────────────────────────────────────────────────────────
// Rangos por fecha de negocio (YYYY-MM-DD, TZ Bogotá). Todo se agrega en SQL; los días
// vacíos los rellena buildCashDays (./analytics).

function instantRange(fromISO: string, toISO: string) {
  return { from: dayRange(fromISO).from, to: dayRange(toISO).to };
}

const sumCents = (col: typeof payments.amountCents | typeof expenses.amountCents) =>
  sql<number>`coalesce(sum(${col}), 0)`.mapWith(Number);
const sumCashCents =
  sql<number>`coalesce(sum(${payments.amountCents}) filter (where ${payments.method} = 'cash'), 0)`.mapWith(
    Number,
  );
const count = () => sql<number>`count(*)`.mapWith(Number);

export async function listClosuresInRange(orgId: string, fromISO: string, toISO: string) {
  return withTenant(orgId, async (tx) => {
    const [rows, [reopened]] = await Promise.all([
      tx
        .select({
          id: cashClosures.id,
          businessDate: cashClosures.businessDate,
          branchId: cashClosures.branchId,
          branchName: branches.name,
          openingCashCents: cashClosures.openingCashCents,
          expectedCashCents: cashClosures.expectedCashCents,
          countedCashCents: cashClosures.countedCashCents,
          differenceCents: cashClosures.differenceCents,
          notes: cashClosures.notes,
          closedBy: cashClosures.closedBy,
          closedByName: user.name,
          createdAt: cashClosures.createdAt,
        })
        .from(cashClosures)
        .leftJoin(user, eq(user.id, cashClosures.closedBy))
        .leftJoin(branches, eq(branches.id, cashClosures.branchId))
        .where(
          and(
            eq(cashClosures.orgId, orgId),
            isNull(cashClosures.deletedAt),
            gte(cashClosures.businessDate, fromISO),
            lte(cashClosures.businessDate, toISO),
          ),
        )
        .orderBy(asc(cashClosures.businessDate)),
      // Un cierre reabierto queda soft-deleted (ver reopenCash): se cuenta aparte.
      tx
        .select({ n: count() })
        .from(cashClosures)
        .where(
          and(
            eq(cashClosures.orgId, orgId),
            isNotNull(cashClosures.reopenedAt),
            gte(cashClosures.businessDate, fromISO),
            lte(cashClosures.businessDate, toISO),
          ),
        ),
    ]);
    return { closures: rows, reopenedCount: reopened?.n ?? 0 };
  });
}

export type CashClosureRow = Awaited<ReturnType<typeof listClosuresInRange>>["closures"][number];

// Por día: cobros en efectivo, cobros por otros medios y gastos en efectivo.
export async function getDailyCashMovements(
  orgId: string,
  fromISO: string,
  toISO: string,
): Promise<DayMovement[]> {
  const { from, to } = instantRange(fromISO, toISO);
  return withTenant(orgId, async (tx) => {
    const [income, outgo] = await Promise.all([
      tx
        .select({
          day: sql<string>`to_char(${payments.paidAt} at time zone ${DEFAULT_TZ}, 'YYYY-MM-DD')`,
          cash: sumCashCents,
          all: sumCents(payments.amountCents),
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
        )
        .groupBy(sql`1`),
      tx
        .select({
          day: sql<string>`to_char(${expenses.spentAt} at time zone ${DEFAULT_TZ}, 'YYYY-MM-DD')`,
          cash: sumCents(expenses.amountCents),
        })
        .from(expenses)
        .where(
          and(
            eq(expenses.orgId, orgId),
            isNull(expenses.deletedAt),
            eq(expenses.status, "completed"),
            eq(expenses.method, "cash"),
            gte(expenses.spentAt, from),
            lte(expenses.spentAt, to),
          ),
        )
        .groupBy(sql`1`),
    ]);
    const map = new Map<string, DayMovement>();
    const get = (date: string) =>
      map.get(date) ?? { date, cashInCents: 0, otherInCents: 0, cashOutCents: 0 };
    for (const r of income) {
      map.set(r.day, { ...get(r.day), cashInCents: r.cash, otherInCents: r.all - r.cash });
    }
    for (const r of outgo) map.set(r.day, { ...get(r.day), cashOutCents: r.cash });
    return [...map.values()];
  });
}

export type MethodSlice = { method: PaymentMethod; cents: number; n: number };

export async function getPaymentMethodMix(
  orgId: string,
  fromISO: string,
  toISO: string,
): Promise<MethodSlice[]> {
  const { from, to } = instantRange(fromISO, toISO);
  return withTenant(orgId, (tx) =>
    tx
      .select({ method: payments.method, cents: sumCents(payments.amountCents), n: count() })
      .from(payments)
      .where(
        and(
          eq(payments.orgId, orgId),
          isNull(payments.deletedAt),
          eq(payments.status, "completed"),
          gte(payments.paidAt, from),
          lte(payments.paidAt, to),
        ),
      )
      .groupBy(payments.method)
      .orderBy(sql`2 desc`),
  );
}

export type CashierStat = {
  userId: string;
  name: string;
  paymentsN: number;
  paymentsCents: number;
  cashCents: number;
  voidedN: number;
  closuresN: number;
  diffCents: number;
  shortClosuresN: number;
};

// Desempeño por persona en el rango: lo que cobró, lo que anuló y cómo le cuadraron sus
// cierres. Solo para quien tiene cashClosure.readAll (la página ya lo exige).
export async function getCashierStats(
  orgId: string,
  fromISO: string,
  toISO: string,
  shortThresholdCents: number,
): Promise<CashierStat[]> {
  const { from, to } = instantRange(fromISO, toISO);
  return withTenant(orgId, async (tx) => {
    const [received, voided, closed] = await Promise.all([
      tx
        .select({
          userId: payments.receivedBy,
          n: count(),
          cents: sumCents(payments.amountCents),
          cash: sumCashCents,
        })
        .from(payments)
        .where(
          and(
            eq(payments.orgId, orgId),
            isNull(payments.deletedAt),
            eq(payments.status, "completed"),
            isNotNull(payments.receivedBy),
            gte(payments.paidAt, from),
            lte(payments.paidAt, to),
          ),
        )
        .groupBy(payments.receivedBy),
      tx
        .select({ userId: payments.voidedBy, n: count() })
        .from(payments)
        .where(
          and(
            eq(payments.orgId, orgId),
            isNull(payments.deletedAt),
            eq(payments.status, "voided"),
            isNotNull(payments.voidedBy),
            gte(payments.voidedAt, from),
            lte(payments.voidedAt, to),
          ),
        )
        .groupBy(payments.voidedBy),
      tx
        .select({
          userId: cashClosures.closedBy,
          n: count(),
          diff: sql<number>`coalesce(sum(${cashClosures.differenceCents}), 0)`.mapWith(Number),
          shorts:
            sql<number>`count(*) filter (where ${cashClosures.differenceCents} < ${-shortThresholdCents})`.mapWith(
              Number,
            ),
        })
        .from(cashClosures)
        .where(
          and(
            eq(cashClosures.orgId, orgId),
            isNull(cashClosures.deletedAt),
            isNotNull(cashClosures.closedBy),
            gte(cashClosures.businessDate, fromISO),
            lte(cashClosures.businessDate, toISO),
          ),
        )
        .groupBy(cashClosures.closedBy),
    ]);

    const stats = new Map<string, CashierStat>();
    const get = (id: string): CashierStat =>
      stats.get(id) ?? {
        userId: id,
        name: "",
        paymentsN: 0,
        paymentsCents: 0,
        cashCents: 0,
        voidedN: 0,
        closuresN: 0,
        diffCents: 0,
        shortClosuresN: 0,
      };
    for (const r of received) {
      if (r.userId) {
        stats.set(r.userId, {
          ...get(r.userId),
          paymentsN: r.n,
          paymentsCents: r.cents,
          cashCents: r.cash,
        });
      }
    }
    for (const r of voided) {
      if (r.userId) stats.set(r.userId, { ...get(r.userId), voidedN: r.n });
    }
    for (const r of closed) {
      if (r.userId) {
        stats.set(r.userId, {
          ...get(r.userId),
          closuresN: r.n,
          diffCents: r.diff,
          shortClosuresN: r.shorts,
        });
      }
    }
    if (stats.size === 0) return [];

    const names = await tx
      .select({ id: user.id, name: user.name })
      .from(user)
      .where(inArray(user.id, [...stats.keys()]));
    const nameById = new Map(names.map((u) => [u.id, u.name]));
    return [...stats.values()]
      .map((s) => ({ ...s, name: nameById.get(s.userId) ?? "Usuario eliminado" }))
      .sort((a, b) => b.paymentsCents - a.paymentsCents);
  });
}
