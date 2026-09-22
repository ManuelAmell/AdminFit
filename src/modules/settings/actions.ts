"use server";

import { revalidatePath } from "next/cache";
import { orgSettings } from "@/db/schema";
import { ForbiddenError, requirePermission } from "@/lib/auth/authorize";
import { parsePesosInput } from "@/lib/money";
import { withTenant } from "@/lib/tenant";
import { audit } from "@/modules/audit";
import { generalSettingsSchema, type GeneralSettingsInput } from "./schema";

export type ActionResult<T = undefined> =
  { ok: true; data: T } | { ok: false; error: string; fieldErrors?: Record<string, string> };

export async function updateGeneralSettings(
  orgSlug: string,
  input: GeneralSettingsInput,
): Promise<ActionResult> {
  try {
    const ctx = await requirePermission(orgSlug, { settings: ["update"] });
    const parsed = generalSettingsSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
    }
    const dayPassPriceCents = parsed.data.dayPassPrice
      ? parsePesosInput(parsed.data.dayPassPrice)
      : null;

    await withTenant(ctx.org.id, async (tx) => {
      await tx
        .insert(orgSettings)
        .values({ orgId: ctx.org.id, dayPassPriceCents })
        .onConflictDoUpdate({
          target: orgSettings.orgId,
          set: { dayPassPriceCents },
        });
      await audit(tx, {
        orgId: ctx.org.id,
        actorId: ctx.userId,
        action: "settings.update",
        entity: "org_settings",
        diff: { dayPassPriceCents },
      });
    });

    revalidatePath(`/app/${orgSlug}/settings/general`);
    revalidatePath(`/app/${orgSlug}/payments/quick`);
    return { ok: true, data: undefined };
  } catch (err) {
    if (err instanceof ForbiddenError) return { ok: false, error: err.message };
    console.error(err);
    return { ok: false, error: "Ocurrió un error inesperado. Intenta de nuevo." };
  }
}
