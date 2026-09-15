import { TZDate } from "@date-fns/tz";
import { endOfDay, endOfMonth, parseISO, startOfDay, startOfMonth, startOfWeek } from "date-fns";
import { and, asc, count, desc, eq, gte, isNull, lte, or, sum } from "drizzle-orm";
import {
  members,
  orgSettings,
  organization,
  payments,
  plans,
  subscriptions,
  user,
} from "@/db/schema";
import { DEFAULT_TZ } from "@/lib/dates";
import { withTenant, type TenantDb } from "@/lib/tenant";
import type { PaymentFilters } from "./schema";

// Rango [from, to] como instantes UTC calculados en la TZ del gimnasio.
export function resolveDateRange(
  filters: PaymentFilters,
  tz = DEFAULT_TZ,
): { from?: Date; to?: Date } {
  const now = new TZDate(Date.now(), tz);
  switch (filters.range) {
    case "today":
      return { from: startOfDay(now), to: endOfDay(now) };
    case "week":
      return { from: startOfWeek(now, { weekStartsOn: 1 }), to: endOfDay(now) };
    case "month":
      return { from: startOfMonth(now), to: endOfMonth(now) };
    case "custom": {
      const from = filters.from ? startOfDay(new TZDate(parseISO(filters.from), tz)) : undefined;
      const to = filters.to ? endOfDay(new TZDate(parseISO(filters.to), tz)) : undefined;
      return { from, to };
    }
    default:
      return {};
  }
}

export function dayRange(dateISO: string, tz = DEFAULT_TZ) {
  const d = new TZDate(parseISO(dateISO), tz);
  return { from: startOfDay(d), to: endOfDay(d) };
}

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
          memberId: payments.memberId,
          memberFirstName: members.firstName,
          memberLastName: members.lastName,
          memberDocument: members.documentNumber,
          receivedByName: user.name,
        })
        .from(payments)
        .innerJoin(members, eq(members.id, payments.memberId))
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
      .innerJoin(members, eq(members.id, payments.memberId))
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

export async function getCashClose(orgId: string, dateISO: string) {
  return withTenant(orgId, async (tx) => {
    const { from, to } = dayRange(dateISO);
    const where = and(
      eq(payments.orgId, orgId),
      isNull(payments.deletedAt),
      gte(payments.paidAt, from),
      lte(payments.paidAt, to),
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
        memberFirstName: members.firstName,
        memberLastName: members.lastName,
        receivedById: payments.receivedBy,
        receivedByName: user.name,
      })
      .from(payments)
      .innerJoin(members, eq(members.id, payments.memberId))
      .leftJoin(user, eq(user.id, payments.receivedBy))
      .where(where)
      .orderBy(asc(payments.receiptNumber));

    const completed = rows.filter((r) => r.status === "completed");
    const voided = rows.filter((r) => r.status === "voided");
    const byMethod = new Map<string, { total: number; n: number }>();
    const byUser = new Map<string, { name: string; total: number; n: number }>();
    for (const r of completed) {
      const m = byMethod.get(r.method) ?? { total: 0, n: 0 };
      byMethod.set(r.method, { total: m.total + r.amountCents, n: m.n + 1 });
      const key = r.receivedById ?? "—";
      const u = byUser.get(key) ?? { name: r.receivedByName ?? "Sin usuario", total: 0, n: 0 };
      byUser.set(key, { ...u, total: u.total + r.amountCents, n: u.n + 1 });
    }
    return {
      completed,
      voided,
      total: completed.reduce((a, r) => a + r.amountCents, 0),
      byMethod: [...byMethod.entries()].map(([method, v]) => ({ method, ...v })),
      byUser: [...byUser.values()],
    };
  });
}
