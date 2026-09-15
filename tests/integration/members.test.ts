import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/db";
import { members, organization, plans, subscriptions } from "@/db/schema";
import { computeEndDate, todayISO } from "@/lib/dates";
import { withTenant } from "@/lib/tenant";
import { parseMembersCsv } from "@/modules/members/import";
import { membershipState } from "@/modules/members/membership-state";
import { getMember, listMembers } from "@/modules/members/queries";
import { listMembersParamsSchema, memberInputSchema } from "@/modules/members/schema";

const run = Date.now().toString(36);
const orgA = { id: `org-ma-${run}`, name: "Gym A", slug: `gym-ma-${run}`, createdAt: new Date() };
const orgB = { id: `org-mb-${run}`, name: "Gym B", slug: `gym-mb-${run}`, createdAt: new Date() };

const base = {
  documentType: "CC" as const,
  firstName: "María",
  lastName: "Gómez",
  gender: "unspecified" as const,
};

describe("módulo socios", () => {
  beforeAll(async () => {
    await db.insert(organization).values([orgA, orgB]);
    await withTenant(orgA.id, (tx) =>
      tx.insert(members).values([
        { ...base, orgId: orgA.id, documentNumber: `1001${run}`, phone: "3001112233" },
        {
          ...base,
          orgId: orgA.id,
          documentNumber: `1002${run}`,
          firstName: "Carlos",
          lastName: "Pérez",
          status: "inactive",
        },
      ]),
    );
    await withTenant(orgB.id, (tx) =>
      tx.insert(members).values({ ...base, orgId: orgB.id, documentNumber: `1001${run}` }),
    );
  });

  afterAll(async () => {
    await db.delete(organization).where(eq(organization.id, orgA.id));
    await db.delete(organization).where(eq(organization.id, orgB.id));
  });

  it("valida y normaliza la entrada", () => {
    const parsed = memberInputSchema.parse({
      ...base,
      documentNumber: " 123456 ",
      email: " MARIA@EJEMPLO.COM ",
      phone: "",
      birthDate: "",
      notes: "",
    });
    expect(parsed.documentNumber).toBe("123456");
    expect(parsed.email).toBe("maria@ejemplo.com");
    expect(parsed.phone).toBeNull();
    expect(parsed.birthDate).toBeNull();
    expect(parsed.notes).toBeNull();
    expect(memberInputSchema.safeParse({ ...base, documentNumber: "12" }).success).toBe(false);
    expect(memberInputSchema.safeParse({ ...base, documentNumber: "1234", email: "x" }).success).toBe(
      false,
    );
  });

  it("lista solo los socios del tenant y busca por nombre/documento/teléfono", async () => {
    const all = await listMembers(orgA.id, listMembersParamsSchema.parse({}));
    expect(all.total).toBe(2);
    expect(all.data.every((m) => m.orgId === orgA.id)).toBe(true);
    expect(all.data.map((m) => m.lastName)).toEqual(["Gómez", "Pérez"]);

    const byName = await listMembers(orgA.id, listMembersParamsSchema.parse({ q: "carlos pé" }));
    expect(byName.data.map((m) => m.firstName)).toEqual(["Carlos"]);

    const byDoc = await listMembers(orgA.id, listMembersParamsSchema.parse({ q: `1002${run}` }));
    expect(byDoc.total).toBe(1);

    const byPhone = await listMembers(orgA.id, listMembersParamsSchema.parse({ q: "300111" }));
    expect(byPhone.data.map((m) => m.firstName)).toEqual(["María"]);

    const inactive = await listMembers(
      orgA.id,
      listMembersParamsSchema.parse({ status: "inactive" }),
    );
    expect(inactive.data.map((m) => m.firstName)).toEqual(["Carlos"]);

    const fromB = await listMembers(orgB.id, listMembersParamsSchema.parse({}));
    expect(fromB.total).toBe(1);
  });

  it("el mismo documento puede existir en dos gimnasios, pero no dos veces en el mismo", async () => {
    const err = await withTenant(orgA.id, (tx) =>
      tx.insert(members).values({ ...base, orgId: orgA.id, documentNumber: `1001${run}` }),
    ).catch((e: unknown) => e);
    const cause = (err as Error & { cause?: { code?: string } }).cause;
    expect(cause?.code).toBe("23505");
  });

  it("getMember devuelve el estado derivado de la membresía", async () => {
    const [m] = await withTenant(orgA.id, (tx) =>
      tx.select().from(members).where(eq(members.documentNumber, `1001${run}`)),
    );
    const before = await getMember(orgA.id, m.id);
    expect(before?.membership).toBe("none");

    const today = todayISO();
    await withTenant(orgA.id, async (tx) => {
      const [plan] = await tx
        .insert(plans)
        .values({ orgId: orgA.id, name: "Mensual", priceCents: 8000000 })
        .returning();
      await tx.insert(subscriptions).values({
        orgId: orgA.id,
        memberId: m.id,
        planId: plan.id,
        startDate: today,
        endDate: computeEndDate(today, "months", 1),
        priceCentsSnapshot: plan.priceCents,
      });
    });
    const after = await getMember(orgA.id, m.id);
    expect(after?.membership).toBe("current");
    expect(after?.subscriptions).toHaveLength(1);
    expect(after?.subscriptions[0].planName).toBe("Mensual");

    // Otro tenant no puede leer la ficha.
    expect(await getMember(orgB.id, m.id)).toBeNull();
  });

  it("membershipState respeta umbrales y días de gracia", () => {
    const today = todayISO();
    const inDays = (n: number) => computeEndDate(today, "days", n);
    expect(membershipState(null, 3)).toBe("none");
    expect(membershipState({ status: "active", endDate: inDays(30) }, 3)).toBe("current");
    expect(membershipState({ status: "active", endDate: inDays(5) }, 3)).toBe("expiring");
    expect(membershipState({ status: "active", endDate: inDays(0) }, 3)).toBe("expiring");
    expect(membershipState({ status: "active", endDate: inDays(-2) }, 3)).toBe("grace");
    expect(membershipState({ status: "expired", endDate: inDays(-4) }, 3)).toBe("expired");
    expect(membershipState({ status: "frozen", endDate: inDays(10) }, 3)).toBe("frozen");
    expect(membershipState({ status: "cancelled", endDate: inDays(10) }, 3)).toBe("none");
  });

  it("parsea CSV con errores por fila y duplicados", () => {
    const csv = [
      "tipo_documento,numero_documento,nombres,apellidos,email,telefono,fecha_nacimiento,genero",
      "CC,2001,Ana,López,ana@x.com,3001234567,1990-01-01,F",
      ",2002,Luis,Ruiz,,,,",
      "CC,20,X,Y,mal,,,",
      "CC,2001,Ana,López,,,,",
    ].join("\n");
    const { rows, headerError } = parseMembersCsv(csv);
    expect(headerError).toBeUndefined();
    expect(rows).toHaveLength(4);
    expect(rows[0]).toMatchObject({ ok: true, row: 2 });
    expect(rows[1]).toMatchObject({ ok: true, row: 3 });
    expect(rows[1].ok && rows[1].values.documentType).toBe("CC");
    expect(rows[2].ok).toBe(false);
    expect(rows[3]).toMatchObject({ ok: false, errors: ["Documento repetido en el archivo (fila 2)."] });

    expect(parseMembersCsv("nombres,apellidos\nA,B").headerError).toMatch(/numero_documento/);
  });
});
