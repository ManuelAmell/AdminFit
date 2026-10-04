"use server";

import { and, desc, eq, isNull, or } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { checkins, members, orgSettings, plans, subscriptions } from "@/db/schema";
import { ForbiddenError, requirePermission } from "@/lib/auth/authorize";
import { todayISO } from "@/lib/dates";
import { withTenant } from "@/lib/tenant";
import { audit } from "@/modules/audit";
import { evaluateCheckin } from "./rules";
import { checkinInputSchema, type CheckinInput } from "./schema";

export type CheckinResultData = {
  id: string;
  status: "granted" | "rejected";
  reason: string;
  member: {
    id: string;
    firstName: string;
    lastName: string;
    documentType: string;
    documentNumber: string;
    photoUrl: string | null;
  };
  planName: string | null;
  visitsUsed?: number;
  visitLimit?: number | null;
  timestamp: string;
};

export type ActionResult<T = undefined> =
  { ok: true; data: T } | { ok: false; error: string; fieldErrors?: Record<string, string> };

function fail(err: unknown): ActionResult<never> {
  if (err instanceof ForbiddenError) return { ok: false, error: err.message };
  console.error(err);
  return { ok: false, error: "Ocurrió un error inesperado al procesar el ingreso." };
}

function parseIdentifier(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.startsWith("AF:")) {
    return trimmed.slice(3).trim();
  }
  try {
    const parsed = JSON.parse(trimmed);
    if (parsed && typeof parsed.memberId === "string") return parsed.memberId;
    if (parsed && typeof parsed.doc === "string") return parsed.doc;
  } catch {
    // No es JSON, usar string directo
  }
  return trimmed;
}

export async function performCheckin(
  orgSlug: string,
  input: CheckinInput,
): Promise<ActionResult<CheckinResultData>> {
  try {
    const { org, userId } = await requirePermission(orgSlug, { checkin: ["create"] });
    const parsed = checkinInputSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: "Identificador de socio inválido." };
    }

    const cleanIdentifier = parseIdentifier(parsed.data.identifier);

    const result = await withTenant(org.id, async (tx) => {
      // 1. Buscar al socio por UUID o por documento
      const isUuid =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
          cleanIdentifier,
        );

      const [memberRow] = await tx
        .select()
        .from(members)
        .where(
          and(
            eq(members.orgId, org.id),
            isNull(members.deletedAt),
            isUuid
              ? or(eq(members.id, cleanIdentifier), eq(members.documentNumber, cleanIdentifier))
              : eq(members.documentNumber, cleanIdentifier),
          ),
        );

      if (!memberRow) {
        return { notFound: true as const };
      }

      // 2. Obtener días de gracia de la organización
      const settings = await tx.query.orgSettings.findFirst({
        where: eq(orgSettings.orgId, org.id),
      });
      const graceDays = settings?.graceDays ?? 3;

      // 3. Obtener la membresía más reciente con su plan
      const latestSubRows = await tx
        .select({
          sub: subscriptions,
          plan: plans,
        })
        .from(subscriptions)
        .leftJoin(plans, eq(plans.id, subscriptions.planId))
        .where(
          and(
            eq(subscriptions.orgId, org.id),
            eq(subscriptions.memberId, memberRow.id),
            isNull(subscriptions.deletedAt),
          ),
        )
        .orderBy(desc(subscriptions.endDate))
        .limit(1);

      const latestSub = latestSubRows[0]
        ? {
            ...latestSubRows[0].sub,
            plan: latestSubRows[0].plan,
          }
        : null;

      // 4. Evaluar check-in
      const evalResult = evaluateCheckin(memberRow, latestSub, graceDays, todayISO());

      // 5. Si tiene límite de visitas y fue aceptado, incrementar contador
      let finalVisitsUsed = latestSub?.visitsUsed;
      if (evalResult.shouldIncrementVisits && latestSub) {
        finalVisitsUsed = latestSub.visitsUsed + 1;
        await tx
          .update(subscriptions)
          .set({ visitsUsed: finalVisitsUsed })
          .where(eq(subscriptions.id, latestSub.id));
      }

      // 6. Registrar en tabla checkins
      const [checkinRow] = await tx
        .insert(checkins)
        .values({
          orgId: org.id,
          memberId: memberRow.id,
          subscriptionId: latestSub?.id ?? null,
          branchId: parsed.data.branchId ?? memberRow.branchId ?? null,
          status: evalResult.status,
          reason: evalResult.reason,
          registeredBy: userId,
        })
        .returning({ id: checkins.id, createdAt: checkins.createdAt });

      await audit(tx, {
        orgId: org.id,
        actorId: userId,
        action: evalResult.status === "granted" ? "checkin.granted" : "checkin.rejected",
        entity: "checkin",
        entityId: checkinRow.id,
        diff: {
          memberId: memberRow.id,
          status: evalResult.status,
          reason: evalResult.reason,
        },
      });

      return {
        notFound: false as const,
        data: {
          id: checkinRow.id,
          status: evalResult.status,
          reason: evalResult.reason,
          member: {
            id: memberRow.id,
            firstName: memberRow.firstName,
            lastName: memberRow.lastName,
            documentType: memberRow.documentType,
            documentNumber: memberRow.documentNumber,
            photoUrl: memberRow.photoUrl,
          },
          planName: latestSub?.plan?.name ?? null,
          visitsUsed: finalVisitsUsed,
          visitLimit: latestSub?.visitLimitSnapshot,
          timestamp: checkinRow.createdAt.toISOString(),
        },
      };
    });

    if (result.notFound) {
      return {
        ok: false,
        error: `No se encontró ningún socio con el identificador "${cleanIdentifier}".`,
      };
    }

    revalidatePath(`/app/${orgSlug}/checkin`);
    return { ok: true, data: result.data };
  } catch (err) {
    return fail(err);
  }
}
