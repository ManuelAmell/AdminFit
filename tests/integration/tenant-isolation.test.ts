import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/db";
import { branches, organization } from "@/db/schema";
import { withPlatform, withTenant } from "@/lib/tenant";

const run = Date.now().toString(36);
const orgA = { id: `org-a-${run}`, name: "Gym A", slug: `gym-a-${run}`, createdAt: new Date() };
const orgB = { id: `org-b-${run}`, name: "Gym B", slug: `gym-b-${run}`, createdAt: new Date() };

describe("aislamiento multi-tenant (withTenant + RLS)", () => {
  beforeAll(async () => {
    await db.insert(organization).values([orgA, orgB]);
    await withTenant(orgA.id, (tx) =>
      tx.insert(branches).values({ orgId: orgA.id, name: "Sede A principal" }),
    );
    await withTenant(orgB.id, (tx) =>
      tx.insert(branches).values({ orgId: orgB.id, name: "Sede B principal" }),
    );
  });

  afterAll(async () => {
    await db.delete(organization).where(eq(organization.id, orgA.id));
    await db.delete(organization).where(eq(organization.id, orgB.id));
  });

  it("cada tenant ve solo sus filas", async () => {
    const seenByA = await withTenant(orgA.id, (tx) => tx.select().from(branches));
    const seenByB = await withTenant(orgB.id, (tx) => tx.select().from(branches));

    expect(seenByA.map((b) => b.orgId)).toEqual([orgA.id]);
    expect(seenByB.map((b) => b.orgId)).toEqual([orgB.id]);
  });

  it("un where explícito por otro org_id sigue devolviendo vacío", async () => {
    const leaked = await withTenant(orgA.id, (tx) =>
      tx.select().from(branches).where(eq(branches.orgId, orgB.id)),
    );
    expect(leaked).toHaveLength(0);
  });

  it("no permite insertar filas de otro tenant (WITH CHECK)", async () => {
    const err = await withTenant(orgA.id, (tx) =>
      tx.insert(branches).values({ orgId: orgB.id, name: "Intruso" }),
    ).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(Error);
    // Drizzle envuelve el error de Postgres; el código 42501 es insufficient_privilege (RLS).
    const cause = (err as Error & { cause?: { code?: string } }).cause;
    expect(cause?.code).toBe("42501");
  });

  it("no permite actualizar ni borrar filas de otro tenant", async () => {
    const updated = await withTenant(orgA.id, (tx) =>
      tx.update(branches).set({ name: "Hackeada" }).where(eq(branches.orgId, orgB.id)).returning(),
    );
    const deleted = await withTenant(orgA.id, (tx) =>
      tx.delete(branches).where(eq(branches.orgId, orgB.id)).returning(),
    );
    expect(updated).toHaveLength(0);
    expect(deleted).toHaveLength(0);
  });

  it("sin contexto de tenant, RLS no devuelve nada (fail closed)", async () => {
    const rows = await db.select().from(branches);
    expect(rows).toHaveLength(0);
  });

  it("withPlatform ve todos los tenants (solo superadmin/seed)", async () => {
    const rows = await withPlatform((tx) =>
      tx
        .select({ orgId: branches.orgId })
        .from(branches)
        .where(sql`${branches.orgId} in (${orgA.id}, ${orgB.id})`),
    );
    expect(rows.map((r) => r.orgId).sort()).toEqual([orgA.id, orgB.id].sort());
  });

  it("withTenant exige orgId", async () => {
    await expect(withTenant("", (tx) => tx.select().from(branches))).rejects.toThrow(/orgId/);
  });
});
