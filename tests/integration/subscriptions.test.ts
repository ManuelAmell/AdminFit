import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/db";
import { members, organization, plans, subscriptions } from "@/db/schema";
import { computeEndDate } from "@/lib/dates";
import { withTenant } from "@/lib/tenant";
import { getPlan, listActivePlans, listPlans } from "@/modules/plans/queries";
import {
  getActiveSubscriptionForMember,
  getMemberPick,
  listSubscriptions,
} from "@/modules/subscriptions/queries";
import { extendedEndDateAfterFreeze, renewalStartDate } from "@/modules/subscriptions/rules";

// Las actions requieren sesión HTTP (requirePermission); aquí se prueban las reglas contra la DB
// real replicando la lógica de persistencia de actions.ts con withTenant + RLS.
const run = Date.now().toString(36);
const orgA = {
  id: `org-subs-a-${run}`,
  name: "Subs A",
  slug: `subs-a-${run}`,
  createdAt: new Date(),
};
const orgB = {
  id: `org-subs-b-${run}`,
  name: "Subs B",
  slug: `subs-b-${run}`,
  createdAt: new Date(),
};

let memberA: string;
let memberB: string;
let planMonthly: string;
let planDays: string;

describe("membresías (integración)", () => {
  beforeAll(async () => {
    await db.insert(organization).values([orgA, orgB]);
    [memberA, planMonthly, planDays] = await withTenant(orgA.id, async (tx) => {
      const [m] = await tx
        .insert(members)
        .values({ orgId: orgA.id, documentNumber: `1${run}`, firstName: "Ana", lastName: "Prueba" })
        .returning({ id: members.id });
      const [pm] = await tx
        .insert(plans)
        .values({
          orgId: orgA.id,
          name: "Mensual",
          priceCents: 12000000,
          durationType: "months",
          durationValue: 1,
        })
        .returning({ id: plans.id });
      const [pd] = await tx
        .insert(plans)
        .values({
          orgId: orgA.id,
          name: "10 días",
          priceCents: 5000000,
          durationType: "days",
          durationValue: 10,
          visitLimit: 10,
        })
        .returning({ id: plans.id });
      return [m.id, pm.id, pd.id];
    });
    [memberB] = await withTenant(orgB.id, async (tx) => {
      const [m] = await tx
        .insert(members)
        .values({ orgId: orgB.id, documentNumber: `2${run}`, firstName: "Beto", lastName: "Otro" })
        .returning({ id: members.id });
      return [m.id];
    });
  });

  afterAll(async () => {
    await db.delete(organization).where(eq(organization.id, orgA.id));
    await db.delete(organization).where(eq(organization.id, orgB.id));
  });

  it("lista planes con conteo de suscripciones y solo activos", async () => {
    const all = await listPlans(orgA.id);
    expect(all.map((p) => p.name).sort()).toEqual(["10 días", "Mensual"]);
    expect(all.every((p) => p.subscriptionCount === 0)).toBe(true);

    await withTenant(orgA.id, (tx) =>
      tx.update(plans).set({ isActive: false }).where(eq(plans.id, planDays)),
    );
    const active = await listActivePlans(orgA.id);
    expect(active.map((p) => p.id)).toEqual([planMonthly]);
    await withTenant(orgA.id, (tx) =>
      tx.update(plans).set({ isActive: true }).where(eq(plans.id, planDays)),
    );
  });

  it("vender crea la membresía con snapshot de precio y fecha fin calculada", async () => {
    const start = "2026-01-15";
    const end = computeEndDate(start, "months", 1);
    const [row] = await withTenant(orgA.id, (tx) =>
      tx
        .insert(subscriptions)
        .values({
          orgId: orgA.id,
          memberId: memberA,
          planId: planMonthly,
          startDate: start,
          endDate: end,
          priceCentsSnapshot: 12000000,
        })
        .returning(),
    );
    expect(row.endDate).toBe("2026-02-15");
    expect(row.status).toBe("active");

    // Cambiar el precio del plan no afecta la membresía vendida.
    await withTenant(orgA.id, (tx) =>
      tx.update(plans).set({ priceCents: 15000000 }).where(eq(plans.id, planMonthly)),
    );
    const [again] = await withTenant(orgA.id, (tx) =>
      tx.select().from(subscriptions).where(eq(subscriptions.id, row.id)),
    );
    expect(again.priceCentsSnapshot).toBe(12000000);
  });

  it("renovar encadena la nueva membresía al día siguiente del fin de la vigente", async () => {
    const current = await getActiveSubscriptionForMember(orgA.id, memberA);
    expect(current).not.toBeNull();
    const today = "2026-02-01"; // aún vigente (vence 2026-02-15)
    const start = renewalStartDate(current!.endDate, today);
    expect(start).toBe("2026-02-16");
    const end = computeEndDate(start, "months", 1);
    expect(end).toBe("2026-03-16");

    await withTenant(orgA.id, (tx) =>
      tx.insert(subscriptions).values({
        orgId: orgA.id,
        memberId: memberA,
        planId: planMonthly,
        startDate: start,
        endDate: end,
        priceCentsSnapshot: 15000000,
      }),
    );
    const latest = await getActiveSubscriptionForMember(orgA.id, memberA);
    expect(latest!.endDate).toBe("2026-03-16");
    expect(latest!.priceCentsSnapshot).toBe(15000000);
  });

  it("congelar y descongelar extiende la fecha fin por los días congelados", async () => {
    const latest = (await getActiveSubscriptionForMember(orgA.id, memberA))!;
    const frozenAt = "2026-02-20";
    await withTenant(orgA.id, (tx) =>
      tx
        .update(subscriptions)
        .set({ status: "frozen", frozenAt, frozenUntil: null })
        .where(eq(subscriptions.id, latest.id)),
    );
    const frozen = (await getActiveSubscriptionForMember(orgA.id, memberA))!;
    expect(frozen.status).toBe("frozen");
    expect(frozen.derived).toBe("congelado");

    const unfrozenAt = "2026-02-27"; // 7 días
    const newEnd = extendedEndDateAfterFreeze(frozen.endDate, frozenAt, unfrozenAt);
    expect(newEnd).toBe("2026-03-23");
    await withTenant(orgA.id, (tx) =>
      tx
        .update(subscriptions)
        .set({ status: "active", endDate: newEnd, frozenAt: null, frozenUntil: null })
        .where(eq(subscriptions.id, latest.id)),
    );
    const active = (await getActiveSubscriptionForMember(orgA.id, memberA))!;
    expect(active.endDate).toBe("2026-03-23");
  });

  it("listSubscriptions filtra, pagina y cuenta por estado", async () => {
    const all = await listSubscriptions(orgA.id, { filter: "all" });
    expect(all.total).toBe(2);
    expect(all.rows[0].member.firstName).toBe("Ana");
    expect(all.rows[0].plan.name).toBe("Mensual");

    const byPlan = await listSubscriptions(orgA.id, { filter: "all", planId: planDays });
    expect(byPlan.total).toBe(0);

    const byName = await listSubscriptions(orgA.id, { filter: "all", q: "ana pru" });
    expect(byName.total).toBe(2);

    const paged = await listSubscriptions(orgA.id, { filter: "all", pageSize: 5, page: 1 });
    expect(paged.rows).toHaveLength(2);
    expect(paged.pageSize).toBe(5);

    const cancelled = await listSubscriptions(orgA.id, { filter: "cancelled" });
    expect(cancelled.total).toBe(0);
    expect(cancelled.counts.cancelled).toBe(0);
  });

  it("aislamiento: la org B no ve ni puede tocar membresías de A", async () => {
    const seenByB = await listSubscriptions(orgB.id, { filter: "all" });
    expect(seenByB.total).toBe(0);
    expect(await getActiveSubscriptionForMember(orgB.id, memberA)).toBeNull();

    const plansB = await listPlans(orgB.id);
    expect(plansB).toHaveLength(0);

    // Las actions validan socio y plan dentro del tenant: desde B no se ven los de A.
    // (Nota: la FK sola no lo impide — ver reporte: hace falta FK compuesta (org_id, id).)
    expect(await getMemberPick(orgB.id, memberA)).toBeNull();
    expect(await getPlan(orgB.id, planMonthly)).toBeNull();
    expect(await getMemberPick(orgB.id, memberB)).not.toBeNull();
  });
});
