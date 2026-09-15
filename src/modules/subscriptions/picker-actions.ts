"use server";

import { and, asc, eq, ilike, isNull, or, sql } from "drizzle-orm";
import { members } from "@/db/schema";
import { requireOrg } from "@/lib/auth/session";
import { withTenant } from "@/lib/tenant";
import type { MemberPick } from "./queries";

// Server Action para el combobox de socios (búsqueda simple por nombre/documento).
export async function searchMembersForPicker(orgSlug: string, q: string): Promise<MemberPick[]> {
  const { org } = await requireOrg(orgSlug);
  const term = q.trim();
  return withTenant(org.id, (tx) =>
    tx
      .select({
        id: members.id,
        firstName: members.firstName,
        lastName: members.lastName,
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
                ilike(members.firstName, `%${term}%`),
                ilike(members.lastName, `%${term}%`),
                ilike(members.documentNumber, `%${term}%`),
                ilike(sql`${members.firstName} || ' ' || ${members.lastName}`, `%${term}%`),
              )
            : undefined,
        ),
      )
      .orderBy(asc(members.lastName), asc(members.firstName))
      .limit(10),
  );
}
