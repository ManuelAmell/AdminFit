"use server";

import { and, asc, eq, ilike, isNull, or, sql } from "drizzle-orm";
import { members } from "@/db/schema";
import { requirePermission } from "@/lib/auth/authorize";
import { withTenant } from "@/lib/tenant";
import type { PickedMember } from "./picker";

// Búsqueda para el combobox de socios (membresías, pagos). Con query vacía devuelve los últimos.
export async function searchMembersForPicker(orgSlug: string, q: string): Promise<PickedMember[]> {
  const { org } = await requirePermission(orgSlug, { gymMember: ["read"] });
  const term = q.trim();
  return withTenant(org.id, (tx) =>
    tx
      .select({
        id: members.id,
        firstName: members.firstName,
        lastName: members.lastName,
        documentType: members.documentType,
        documentNumber: members.documentNumber,
        status: members.status,
      })
      .from(members)
      .where(
        and(
          eq(members.orgId, org.id),
          isNull(members.deletedAt),
          term
            ? or(
                ilike(sql`${members.firstName} || ' ' || ${members.lastName}`, `%${term}%`),
                ilike(members.documentNumber, `%${term}%`),
              )
            : undefined,
        ),
      )
      .orderBy(
        term ? asc(members.lastName) : sql`${members.createdAt} desc`,
        asc(members.firstName),
      )
      .limit(10),
  );
}
