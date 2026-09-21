import { and, asc, count, desc, eq, ilike, inArray, isNull, or, sql } from "drizzle-orm";
import { members, orgSettings, payments, plans, subscriptions } from "@/db/schema";
import { withTenant } from "@/lib/tenant";
import { membershipState } from "./membership-state";
import type { ListMembersParams, MembershipState } from "./schema";

export type MemberRow = typeof members.$inferSelect & {
  membership: MembershipState;
  endDate: string | null;
};

export async function listMembers(orgId: string, params: ListMembersParams) {
  return withTenant(orgId, async (tx) => {
    const conditions = [eq(members.orgId, orgId), isNull(members.deletedAt)];
    if (params.status !== "all") conditions.push(eq(members.status, params.status));
    if (params.q) {
      const like = `%${params.q}%`;
      conditions.push(
        or(
          ilike(sql`${members.firstName} || ' ' || ${members.lastName}`, like),
          ilike(members.documentNumber, like),
          ilike(members.phone, like),
          ilike(members.email, like),
        )!,
      );
    }
    const where = and(...conditions);

    const orderCol =
      params.sort === "document"
        ? members.documentNumber
        : params.sort === "createdAt"
          ? members.createdAt
          : sql`${members.lastName} || ' ' || ${members.firstName}`;
    const orderBy = params.dir === "desc" ? desc(orderCol) : asc(orderCol);

    const [rows, [{ total }], settings] = await Promise.all([
      tx
        .select()
        .from(members)
        .where(where)
        .orderBy(orderBy)
        .limit(params.pageSize)
        .offset((params.page - 1) * params.pageSize),
      tx.select({ total: count() }).from(members).where(where),
      tx.query.orgSettings.findFirst({ where: eq(orgSettings.orgId, orgId) }),
    ]);

    const ids = rows.map((r) => r.id);
    const latestSubs = ids.length
      ? await tx
          .selectDistinctOn([subscriptions.memberId], {
            memberId: subscriptions.memberId,
            status: subscriptions.status,
            endDate: subscriptions.endDate,
          })
          .from(subscriptions)
          .where(and(inArray(subscriptions.memberId, ids), isNull(subscriptions.deletedAt)))
          .orderBy(subscriptions.memberId, desc(subscriptions.endDate))
      : [];
    const subByMember = new Map(latestSubs.map((s) => [s.memberId, s]));
    const graceDays = settings?.graceDays ?? 3;

    const data: MemberRow[] = rows.map((r) => {
      const sub = subByMember.get(r.id) ?? null;
      return { ...r, membership: membershipState(sub, graceDays), endDate: sub?.endDate ?? null };
    });

    return { data, total, page: params.page, pageSize: params.pageSize };
  });
}

export async function getMember(orgId: string, id: string) {
  return withTenant(orgId, async (tx) => {
    const member = await tx.query.members.findFirst({
      where: and(eq(members.id, id), eq(members.orgId, orgId), isNull(members.deletedAt)),
    });
    if (!member) return null;

    const [subs, pays, settings] = await Promise.all([
      tx
        .select({
          id: subscriptions.id,
          status: subscriptions.status,
          startDate: subscriptions.startDate,
          endDate: subscriptions.endDate,
          priceCents: subscriptions.priceCentsSnapshot,
          planName: plans.name,
          frozenUntil: subscriptions.frozenUntil,
        })
        .from(subscriptions)
        .leftJoin(plans, eq(plans.id, subscriptions.planId))
        .where(and(eq(subscriptions.memberId, id), isNull(subscriptions.deletedAt)))
        .orderBy(desc(subscriptions.endDate))
        .limit(20),
      tx
        .select({
          id: payments.id,
          amountCents: payments.amountCents,
          method: payments.method,
          paidAt: payments.paidAt,
          receiptNumber: payments.receiptNumber,
          status: payments.status,
        })
        .from(payments)
        .where(and(eq(payments.memberId, id), isNull(payments.deletedAt)))
        .orderBy(desc(payments.paidAt))
        .limit(20),
      tx.query.orgSettings.findFirst({ where: eq(orgSettings.orgId, orgId) }),
    ]);

    const latest = subs[0] ?? null;
    const graceDays = settings?.graceDays ?? 3;
    return {
      member,
      subscriptions: subs,
      payments: pays,
      membership: membershipState(latest, graceDays),
      latestSubscription: latest,
    };
  });
}

export async function listBranches(orgId: string) {
  return withTenant(orgId, (tx) =>
    tx.query.branches.findMany({
      where: (b, { and, eq, isNull }) => and(eq(b.orgId, orgId), isNull(b.deletedAt)),
      orderBy: (b, { asc }) => [asc(b.name)],
    }),
  );
}
