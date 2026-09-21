"use server";

import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { organization } from "@/db/schema";
import { auth } from "@/lib/auth/auth";
import { requireSuperadmin } from "@/lib/auth/session";
import { withPlatform } from "@/lib/tenant";
import { audit } from "@/modules/audit";

export type ActionResult<T = undefined> = { ok: true; data: T } | { ok: false; error: string };

const ORG_STATUSES = ["active", "suspended"] as const;
export type OrgStatus = (typeof ORG_STATUSES)[number];
const setOrgStatusSchema = z.object({
  orgId: z.uuid(),
  status: z.enum(ORG_STATUSES),
});

export async function setOrgStatus(orgId: string, status: OrgStatus): Promise<ActionResult> {
  const session = await requireSuperadmin();
  const parsed = setOrgStatusSchema.safeParse({ orgId, status });
  if (!parsed.success) return { ok: false, error: "Datos inválidos." };
  try {
    await withPlatform(async (tx) => {
      await tx
        .update(organization)
        .set({ status: parsed.data.status })
        .where(eq(organization.id, parsed.data.orgId));
      await audit(tx, {
        orgId: parsed.data.orgId,
        actorId: session.user.id,
        action:
          parsed.data.status === "suspended" ? "organization.suspend" : "organization.reactivate",
        entity: "organization",
        entityId: parsed.data.orgId,
      });
    });
  } catch (err) {
    console.error(err);
    return { ok: false, error: "No se pudo actualizar el estado del gimnasio." };
  }
  revalidatePath("/admin");
  return { ok: true, data: undefined };
}

// Entra a la sesión del dueño del gimnasio para dar soporte.
export async function impersonateOwner(orgSlug: string, userId: string): Promise<ActionResult> {
  await requireSuperadmin();
  try {
    await auth.api.impersonateUser({ headers: await headers(), body: { userId } });
  } catch (err) {
    console.error(err);
    return { ok: false, error: "No se pudo iniciar la sesión de soporte." };
  }
  // redirect() lanza NEXT_REDIRECT — nunca envolver esta línea en try/catch.
  redirect(`/app/${orgSlug}/dashboard`);
}

export async function stopImpersonating() {
  await auth.api.stopImpersonating({ headers: await headers() });
  redirect("/admin");
}
