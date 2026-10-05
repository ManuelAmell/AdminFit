import { and, asc, count, desc, eq, gte, isNull, lte, ne, or, sql, sum } from "drizzle-orm";
import {
  branches,
  members,
  orgSettings,
  organization,
  payments,
  plans,
  subscriptions,
  user,
} from "@/db/schema";
import { dayRange, resolveDateRange } from "@/lib/dates";
import { withTenant, type TenantDb } from "@/lib/tenant";
import type { PaymentFilters } from "./schema";

export { dayRange, resolveDateRange };

function paymentConditions(orgId: string, filters: PaymentFilters) {
  const { from, to } = resolveDateRange(filters);
  return and(
    eq(payments.orgId, orgId),
    isNull(payments.deletedAt),
    from ? gte(payments.paidAt, from) : undefined,
    to ? lte(payments.paidAt, to) : undefined,
    filters.method ? eq(payments.method, filters.method) : undefined,
    filters.status ? eq(payments.status, filters.status) : undefined,
    filters.memberId ? eq(payments.memberId, filters.memberId) : undefined,
  );
}

// Solo el total de pagos completados, sin traer filas de pagos (para KPIs/dashboard).
export async function getCompletedPaymentsTotal(
  orgId: string,
  filters: PaymentFilters,
): Promise<number> {
  return withTenant(orgId, async (tx) => {
    const where = and(paymentConditions(orgId, filters), eq(payments.status, "completed"));
    const [row] = await tx
      .select({ total: sum(payments.amountCents).mapWith(Number) })
      .from(payments)
      .where(where);
    return row?.total ?? 0;
  });
}

export async function listPayments(orgId: string, filters: PaymentFilters) {
  return withTenant(orgId, async (tx) => {
    const where = paymentConditions(orgId, filters);
    const offset = (filters.page - 1) * filters.pageSize;

    const [rows, [{ total }], totals] = await Promise.all([
      tx
        .select({
          id: payments.id,
          receiptNumber: payments.receiptNumber,
          amountCents: payments.amountCents,
          method: payments.method,
          status: payments.status,
          paidAt: payments.paidAt,
          reference: payments.reference,
          concept: payments.concept,
          memberId: payments.memberId,
          payerName: payments.payerName,
          memberFirstName: members.firstName,
          memberLastName: members.lastName,
          memberDocument: members.documentNumber,
          receivedByName: user.name,
        })
        .from(payments)
        // left, no inner: la venta rápida (5.3) no tiene socio.
        .leftJoin(members, eq(members.id, payments.memberId))
        .leftJoin(user, eq(user.id, payments.receivedBy))
        .where(where)
        .orderBy(desc(payments.paidAt), desc(payments.receiptNumber))
        .limit(filters.pageSize)
        .offset(offset),
      tx.select({ total: count() }).from(payments).where(where),
      tx
        .select({
          method: payments.method,
          status: payments.status,
          total: sum(payments.amountCents).mapWith(Number),
          n: count(),
        })
        .from(payments)
        .where(where)
        .groupBy(payments.method, payments.status),
    ]);

    const completedTotal = totals
      .filter((t) => t.status === "completed")
      .reduce((acc, t) => acc + (t.total ?? 0), 0);

    return {
      rows,
      total,
      page: filters.page,
      pageSize: filters.pageSize,
      pageCount: Math.max(1, Math.ceil(total / filters.pageSize)),
      totals,
      completedTotal,
    };
  });
}

export async function getPayment(orgId: string, paymentId: string) {
  return withTenant(orgId, async (tx) => {
    const [row] = await tx
      .select({
        payment: payments,
        member: {
          id: members.id,
          firstName: members.firstName,
          lastName: members.lastName,
          documentType: members.documentType,
          documentNumber: members.documentNumber,
          phone: members.phone,
          email: members.email,
        },
        subscription: {
          id: subscriptions.id,
          startDate: subscriptions.startDate,
          endDate: subscriptions.endDate,
          status: subscriptions.status,
          priceCentsSnapshot: subscriptions.priceCentsSnapshot,
        },
        planName: plans.name,
        receivedByName: user.name,
      })
      .from(payments)
      .leftJoin(members, eq(members.id, payments.memberId))
      .leftJoin(subscriptions, eq(subscriptions.id, payments.subscriptionId))
      .leftJoin(plans, eq(plans.id, subscriptions.planId))
      .leftJoin(user, eq(user.id, payments.receivedBy))
      .where(and(eq(payments.id, paymentId), isNull(payments.deletedAt)))
      .limit(1);
    if (!row) return null;

    let voidedByName: string | null = null;
    if (row.payment.voidedBy) {
      const [u] = await tx
        .select({ name: user.name })
        .from(user)
        .where(eq(user.id, row.payment.voidedBy))
        .limit(1);
      voidedByName = u?.name ?? null;
    }
    return { ...row, voidedByName };
  });
}

export async function getSubscriptionBalanceTx(tx: TenantDb, subscriptionId: string) {
  const [sub] = await tx
    .select({ price: subscriptions.priceCentsSnapshot })
    .from(subscriptions)
    .where(eq(subscriptions.id, subscriptionId))
    .limit(1);
  if (!sub) return null;
  const [{ paid }] = await tx
    .select({ paid: sum(payments.amountCents).mapWith(Number) })
    .from(payments)
    .where(
      and(
        eq(payments.subscriptionId, subscriptionId),
        eq(payments.status, "completed"),
        isNull(payments.deletedAt),
      ),
    );
  const paidCents = paid ?? 0;
  return { priceCents: sub.price, paidCents, balanceCents: sub.price - paidCents };
}

export async function getSubscriptionBalance(orgId: string, subscriptionId: string) {
  return withTenant(orgId, (tx) => getSubscriptionBalanceTx(tx, subscriptionId));
}

// Cartera (Fase 5.5): un socio debe cuando su plan cuesta más de lo que ha pagado.
// Un solo query agregado (no N+1 por suscripción como getSubscriptionBalanceTx) — las
// suscripciones canceladas no cuentan (no se les va a cobrar). Todos los roles con
// `debt.read` ven la misma lista; solo el total agregado se gatea por finance.read en la
// página (ver Fase 5 slice 0).
export async function listDebtors(orgId: string) {
  return withTenant(orgId, async (tx) => {
    const paidBySub = tx
      .select({
        subscriptionId: payments.subscriptionId,
        paid: sum(payments.amountCents).mapWith(Number).as("paid"),
      })
      .from(payments)
      .where(and(eq(payments.status, "completed"), isNull(payments.deletedAt)))
      .groupBy(payments.subscriptionId)
      .as("paid_by_sub");

    const balanceExpr = sql<number>`${subscriptions.priceCentsSnapshot} - coalesce(${paidBySub.paid}, 0)`;

    const rows = await tx
      .select({
        subscriptionId: subscriptions.id,
        memberId: members.id,
        memberFirstName: members.firstName,
        memberLastName: members.lastName,
        memberDocument: members.documentNumber,
        planName: plans.name,
        status: subscriptions.status,
        startDate: subscriptions.startDate,
        endDate: subscriptions.endDate,
        priceCents: subscriptions.priceCentsSnapshot,
        paidCents: sql<number>`coalesce(${paidBySub.paid}, 0)`.mapWith(Number),
        balanceCents: balanceExpr.mapWith(Number),
      })
      .from(subscriptions)
      .innerJoin(members, eq(members.id, subscriptions.memberId))
      .innerJoin(plans, eq(plans.id, subscriptions.planId))
      .leftJoin(paidBySub, eq(paidBySub.subscriptionId, subscriptions.id))
      .where(
        and(
          eq(subscriptions.orgId, orgId),
          isNull(subscriptions.deletedAt),
          isNull(members.deletedAt),
          ne(subscriptions.status, "cancelled"),
          sql`${balanceExpr} > 0`,
        ),
      )
      .orderBy(desc(balanceExpr));

    return rows;
  });
}

// Solo el conteo, para el badge de "Cartera" en el sidebar (se pide en cada navegación
// dentro de la org — layout.tsx — así que se evita traer filas o incluso sumar montos).
export async function getDebtorsCount(orgId: string): Promise<number> {
  return withTenant(orgId, async (tx) => {
    const paidBySub = tx
      .select({
        subscriptionId: payments.subscriptionId,
        paid: sum(payments.amountCents).mapWith(Number).as("paid"),
      })
      .from(payments)
      .where(and(eq(payments.status, "completed"), isNull(payments.deletedAt)))
      .groupBy(payments.subscriptionId)
      .as("paid_by_sub");

    const [row] = await tx
      .select({ n: count() })
      .from(subscriptions)
      .leftJoin(paidBySub, eq(paidBySub.subscriptionId, subscriptions.id))
      .where(
        and(
          eq(subscriptions.orgId, orgId),
          isNull(subscriptions.deletedAt),
          ne(subscriptions.status, "cancelled"),
          sql`${subscriptions.priceCentsSnapshot} - coalesce(${paidBySub.paid}, 0) > 0`,
        ),
      );
    return row?.n ?? 0;
  });
}

// Solo la suma, para el KPI "Por cobrar" del dashboard (evita traer todas las filas).
export async function getTotalDebtCents(orgId: string): Promise<number> {
  return withTenant(orgId, async (tx) => {
    const paidBySub = tx
      .select({
        subscriptionId: payments.subscriptionId,
        paid: sum(payments.amountCents).mapWith(Number).as("paid"),
      })
      .from(payments)
      .where(and(eq(payments.status, "completed"), isNull(payments.deletedAt)))
      .groupBy(payments.subscriptionId)
      .as("paid_by_sub");

    const balanceExpr = sql<number>`${subscriptions.priceCentsSnapshot} - coalesce(${paidBySub.paid}, 0)`;

    const [row] = await tx
      .select({ total: sql<number>`coalesce(sum(greatest(${balanceExpr}, 0)), 0)`.mapWith(Number) })
      .from(subscriptions)
      .leftJoin(paidBySub, eq(paidBySub.subscriptionId, subscriptions.id))
      .where(
        and(
          eq(subscriptions.orgId, orgId),
          isNull(subscriptions.deletedAt),
          ne(subscriptions.status, "cancelled"),
        ),
      );
    return row?.total ?? 0;
  });
}

// Membresía vigente (o la más reciente no cancelada) del socio con su saldo.
export async function getMemberBillingContext(orgId: string, memberId: string) {
  return withTenant(orgId, async (tx) => {
    const [m] = await tx
      .select({
        id: members.id,
        firstName: members.firstName,
        lastName: members.lastName,
        documentType: members.documentType,
        documentNumber: members.documentNumber,
      })
      .from(members)
      .where(and(eq(members.id, memberId), isNull(members.deletedAt)))
      .limit(1);
    if (!m) return null;

    const subs = await tx
      .select({
        id: subscriptions.id,
        startDate: subscriptions.startDate,
        endDate: subscriptions.endDate,
        status: subscriptions.status,
        priceCentsSnapshot: subscriptions.priceCentsSnapshot,
        planName: plans.name,
      })
      .from(subscriptions)
      .innerJoin(plans, eq(plans.id, subscriptions.planId))
      .where(
        and(
          eq(subscriptions.memberId, memberId),
          isNull(subscriptions.deletedAt),
          or(eq(subscriptions.status, "active"), eq(subscriptions.status, "frozen")),
        ),
      )
      .orderBy(desc(subscriptions.endDate))
      .limit(3);

    const withBalance = await Promise.all(
      subs.map(async (s) => ({ ...s, balance: await getSubscriptionBalanceTx(tx, s.id) })),
    );
    return { member: m, subscriptions: withBalance };
  });
}

export async function getOrgReceiptInfo(orgId: string) {
  return withTenant(orgId, async (tx) => {
    const [org] = await tx
      .select({
        name: organization.name,
        slug: organization.slug,
        city: organization.city,
        logo: organization.logo,
      })
      .from(organization)
      .where(eq(organization.id, orgId))
      .limit(1);
    const [settings] = await tx
      .select()
      .from(orgSettings)
      .where(eq(orgSettings.orgId, orgId))
      .limit(1);
    return { org, settings: settings ?? null };
  });
}

// `scope.receivedBy` limita el cierre a los pagos de un usuario: se exige cuando quien
// consulta no tiene `payment.readAll` (Recepción), para que no vea los cobros ajenos.
export async function getCashClose(
  orgId: string,
  dateISO: string,
  scope: { receivedBy?: string } = {},
) {
  return withTenant(orgId, async (tx) => {
    const { from, to } = dayRange(dateISO);
    const where = and(
      eq(payments.orgId, orgId),
      isNull(payments.deletedAt),
      gte(payments.paidAt, from),
      lte(payments.paidAt, to),
      scope.receivedBy ? eq(payments.receivedBy, scope.receivedBy) : undefined,
    );
    const rows = await tx
      .select({
        id: payments.id,
        receiptNumber: payments.receiptNumber,
        amountCents: payments.amountCents,
        method: payments.method,
        status: payments.status,
        paidAt: payments.paidAt,
        reference: payments.reference,
        payerName: payments.payerName,
        memberFirstName: members.firstName,
        memberLastName: members.lastName,
        receivedById: payments.receivedBy,
        receivedByName: user.name,
        branchId: payments.branchId,
        branchName: branches.name,
      })
      .from(payments)
      // left, no inner: la venta rápida (5.3) no tiene socio (usa payerName en su lugar).
      .leftJoin(members, eq(members.id, payments.memberId))
      .leftJoin(user, eq(user.id, payments.receivedBy))
      .leftJoin(branches, eq(branches.id, payments.branchId))
      .where(where)
      .orderBy(asc(payments.receiptNumber));

    const completed = rows.filter((r) => r.status === "completed");
    const voided = rows.filter((r) => r.status === "voided");
    const byMethod = new Map<string, { total: number; n: number }>();
    const byUser = new Map<string, { name: string; total: number; n: number }>();
    const byBranch = new Map<string, { id: string; name: string; total: number; n: number }>();
    for (const r of completed) {
      const m = byMethod.get(r.method) ?? { total: 0, n: 0 };
      byMethod.set(r.method, { total: m.total + r.amountCents, n: m.n + 1 });
      const key = r.receivedById ?? "—";
      const u = byUser.get(key) ?? { name: r.receivedByName ?? "Sin usuario", total: 0, n: 0 };
      byUser.set(key, { ...u, total: u.total + r.amountCents, n: u.n + 1 });
      const branchKey = r.branchId ?? "—";
      const b = byBranch.get(branchKey) ?? {
        id: branchKey,
        name: r.branchName ?? "Sin sede",
        total: 0,
        n: 0,
      };
      byBranch.set(branchKey, { ...b, total: b.total + r.amountCents, n: b.n + 1 });
    }
    return {
      completed,
      voided,
      total: completed.reduce((a, r) => a + r.amountCents, 0),
      byMethod: [...byMethod.entries()].map(([method, v]) => ({ method, ...v })),
      byUser: [...byUser.values()],
      byBranch: [...byBranch.values()],
    };
  });
}
