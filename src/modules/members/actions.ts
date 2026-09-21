"use server";

import { and, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { members } from "@/db/schema";
import { ForbiddenError, requirePermission } from "@/lib/auth/authorize";
import { withTenant } from "@/lib/tenant";
import { audit } from "@/modules/audit";
import { memberInputSchema, memberStatusSchema, type MemberInput } from "./schema";

export type ActionResult<T = undefined> =
  { ok: true; data: T } | { ok: false; error: string; fieldErrors?: Record<string, string> };

function isUniqueViolation(err: unknown) {
  const cause = (err as { cause?: { code?: string } })?.cause;
  return cause?.code === "23505";
}

function fail(err: unknown): ActionResult<never> {
  if (err instanceof ForbiddenError) return { ok: false, error: err.message };
  if (isUniqueViolation(err)) {
    return {
      ok: false,
      error: "Ya existe un socio con ese tipo y número de documento.",
      fieldErrors: { documentNumber: "Ya existe un socio con este documento." },
    };
  }
  console.error(err);
  return { ok: false, error: "Ocurrió un error inesperado. Intenta de nuevo." };
}

function zodFieldErrors(error: { issues: { path: PropertyKey[]; message: string }[] }) {
  const out: Record<string, string> = {};
  for (const i of error.issues) {
    const key = String(i.path[0] ?? "_");
    if (!out[key]) out[key] = i.message;
  }
  return out;
}

export async function createMember(
  orgSlug: string,
  input: MemberInput,
): Promise<ActionResult<{ id: string }>> {
  try {
    const { org, userId } = await requirePermission(orgSlug, { gymMember: ["create"] });
    const parsed = memberInputSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: "Revisa los campos.", fieldErrors: zodFieldErrors(parsed.error) };
    }
    const id = await withTenant(org.id, async (tx) => {
      const [row] = await tx
        .insert(members)
        .values({ ...parsed.data, orgId: org.id })
        .returning({ id: members.id });
      await audit(tx, {
        orgId: org.id,
        actorId: userId,
        action: "member.create",
        entity: "member",
        entityId: row.id,
        diff: { after: parsed.data },
      });
      return row.id;
    });
    revalidatePath(`/app/${orgSlug}/members`);
    return { ok: true, data: { id } };
  } catch (err) {
    return fail(err);
  }
}

export async function updateMember(
  orgSlug: string,
  id: string,
  input: MemberInput,
): Promise<ActionResult> {
  try {
    const { org, userId } = await requirePermission(orgSlug, { gymMember: ["update"] });
    const parsed = memberInputSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: "Revisa los campos.", fieldErrors: zodFieldErrors(parsed.error) };
    }
    const updated = await withTenant(org.id, async (tx) => {
      const [before] = await tx
        .select()
        .from(members)
        .where(and(eq(members.id, id), isNull(members.deletedAt)));
      if (!before) return false;
      await tx.update(members).set(parsed.data).where(eq(members.id, id));
      await audit(tx, {
        orgId: org.id,
        actorId: userId,
        action: "member.update",
        entity: "member",
        entityId: id,
        diff: { before, after: parsed.data },
      });
      return true;
    });
    if (!updated) return { ok: false, error: "El socio no existe." };
    revalidatePath(`/app/${orgSlug}/members`);
    revalidatePath(`/app/${orgSlug}/members/${id}`);
    return { ok: true, data: undefined };
  } catch (err) {
    return fail(err);
  }
}

export async function setMemberStatus(
  orgSlug: string,
  id: string,
  status: string,
): Promise<ActionResult> {
  try {
    const { org, userId } = await requirePermission(orgSlug, { gymMember: ["update"] });
    const parsed = memberStatusSchema.safeParse(status);
    if (!parsed.success) return { ok: false, error: "Estado inválido." };
    const changed = await withTenant(org.id, async (tx) => {
      const [row] = await tx
        .update(members)
        .set({ status: parsed.data })
        .where(and(eq(members.id, id), isNull(members.deletedAt)))
        .returning({ id: members.id });
      if (!row) return false;
      await audit(tx, {
        orgId: org.id,
        actorId: userId,
        action: "member.status",
        entity: "member",
        entityId: id,
        diff: { status: parsed.data },
      });
      return true;
    });
    if (!changed) return { ok: false, error: "El socio no existe." };
    revalidatePath(`/app/${orgSlug}/members`);
    revalidatePath(`/app/${orgSlug}/members/${id}`);
    return { ok: true, data: undefined };
  } catch (err) {
    return fail(err);
  }
}

export async function deleteMember(orgSlug: string, id: string): Promise<ActionResult> {
  try {
    const { org, userId } = await requirePermission(orgSlug, { gymMember: ["delete"] });
    const deleted = await withTenant(org.id, async (tx) => {
      const [row] = await tx
        .update(members)
        .set({ deletedAt: new Date(), status: "inactive" })
        .where(and(eq(members.id, id), isNull(members.deletedAt)))
        .returning({ id: members.id });
      if (!row) return false;
      await audit(tx, {
        orgId: org.id,
        actorId: userId,
        action: "member.delete",
        entity: "member",
        entityId: id,
      });
      return true;
    });
    if (!deleted) return { ok: false, error: "El socio no existe." };
    revalidatePath(`/app/${orgSlug}/members`);
    return { ok: true, data: undefined };
  } catch (err) {
    return fail(err);
  }
}
