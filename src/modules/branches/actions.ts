"use server";

import { and, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { branches } from "@/db/schema";
import { ForbiddenError, requirePermission } from "@/lib/auth/authorize";
import { withTenant } from "@/lib/tenant";
import { audit } from "@/modules/audit";
import { branchInputSchema, type BranchInput } from "./schema";

export type ActionResult<T = undefined> =
  { ok: true; data: T } | { ok: false; error: string; fieldErrors?: Record<string, string> };

function fail(err: unknown): ActionResult<never> {
  if (err instanceof ForbiddenError) return { ok: false, error: err.message };
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

export async function createBranch(
  orgSlug: string,
  input: BranchInput,
): Promise<ActionResult<{ id: string }>> {
  try {
    const { org, userId } = await requirePermission(orgSlug, { settings: ["update"] });
    const parsed = branchInputSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: "Revisa los campos.", fieldErrors: zodFieldErrors(parsed.error) };
    }
    const id = await withTenant(org.id, async (tx) => {
      const [row] = await tx
        .insert(branches)
        .values({ ...parsed.data, orgId: org.id })
        .returning({ id: branches.id });
      await audit(tx, {
        orgId: org.id,
        actorId: userId,
        action: "branch.create",
        entity: "branch",
        entityId: row.id,
        diff: { after: parsed.data },
      });
      return row.id;
    });
    revalidatePath(`/app/${orgSlug}/settings/branches`);
    revalidatePath(`/app/${orgSlug}/members/new`);
    return { ok: true, data: { id } };
  } catch (err) {
    return fail(err);
  }
}

export async function updateBranch(
  orgSlug: string,
  id: string,
  input: BranchInput,
): Promise<ActionResult> {
  try {
    const { org, userId } = await requirePermission(orgSlug, { settings: ["update"] });
    const parsed = branchInputSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: "Revisa los campos.", fieldErrors: zodFieldErrors(parsed.error) };
    }
    const updated = await withTenant(org.id, async (tx) => {
      const [before] = await tx
        .select()
        .from(branches)
        .where(and(eq(branches.id, id), isNull(branches.deletedAt)));
      if (!before) return false;
      await tx.update(branches).set(parsed.data).where(eq(branches.id, id));
      await audit(tx, {
        orgId: org.id,
        actorId: userId,
        action: "branch.update",
        entity: "branch",
        entityId: id,
        diff: { before, after: parsed.data },
      });
      return true;
    });
    if (!updated) return { ok: false, error: "La sede no existe." };
    revalidatePath(`/app/${orgSlug}/settings/branches`);
    revalidatePath(`/app/${orgSlug}/members/new`);
    return { ok: true, data: undefined };
  } catch (err) {
    return fail(err);
  }
}

export async function deleteBranch(orgSlug: string, id: string): Promise<ActionResult> {
  try {
    const { org, userId } = await requirePermission(orgSlug, { settings: ["update"] });
    const deleted = await withTenant(org.id, async (tx) => {
      const [row] = await tx
        .update(branches)
        .set({ deletedAt: new Date() })
        .where(and(eq(branches.id, id), isNull(branches.deletedAt)))
        .returning({ id: branches.id });
      if (!row) return false;
      await audit(tx, {
        orgId: org.id,
        actorId: userId,
        action: "branch.delete",
        entity: "branch",
        entityId: id,
      });
      return true;
    });
    if (!deleted) return { ok: false, error: "La sede no existe." };
    revalidatePath(`/app/${orgSlug}/settings/branches`);
    revalidatePath(`/app/${orgSlug}/members/new`);
    return { ok: true, data: undefined };
  } catch (err) {
    return fail(err);
  }
}
