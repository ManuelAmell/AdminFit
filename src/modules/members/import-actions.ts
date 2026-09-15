"use server";

import { and, inArray, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { members } from "@/db/schema";
import { ForbiddenError, requirePermission } from "@/lib/auth/authorize";
import { withTenant } from "@/lib/tenant";
import { audit } from "@/modules/audit";
import { parseMembersCsv, type ImportRowResult } from "./import";

const MAX_BYTES = 2 * 1024 * 1024;
const MAX_ROWS = 2000;

export type ImportSummary = {
  inserted: number;
  skipped: { row: number; errors: string[] }[];
};

export async function importMembersCsv(
  orgSlug: string,
  formData: FormData,
): Promise<{ ok: true; data: ImportSummary } | { ok: false; error: string }> {
  try {
    const { org, userId } = await requirePermission(orgSlug, { gymMember: ["import"] });
    const file = formData.get("file");
    if (!(file instanceof File)) return { ok: false, error: "Adjunta un archivo CSV." };
    if (file.size > MAX_BYTES) return { ok: false, error: "El archivo supera 2 MB." };

    const { rows, headerError } = parseMembersCsv(await file.text());
    if (headerError) return { ok: false, error: headerError };
    if (rows.length === 0) return { ok: false, error: "El archivo no tiene filas." };
    if (rows.length > MAX_ROWS)
      return { ok: false, error: `Máximo ${MAX_ROWS} filas por archivo.` };

    const summary = await withTenant(org.id, async (tx) => {
      const valid = rows.filter((r): r is Extract<ImportRowResult, { ok: true }> => r.ok);
      const skipped = rows
        .filter((r): r is Extract<ImportRowResult, { ok: false }> => !r.ok)
        .map((r) => ({ row: r.row, errors: r.errors }));

      // Documentos ya existentes en la org → se omiten con mensaje.
      const docs = valid.map((r) => r.values.documentNumber);
      const existing = docs.length
        ? await tx
            .select({ documentType: members.documentType, documentNumber: members.documentNumber })
            .from(members)
            .where(and(inArray(members.documentNumber, docs), isNull(members.deletedAt)))
        : [];
      const existingKeys = new Set(existing.map((e) => `${e.documentType}:${e.documentNumber}`));

      const toInsert = valid.filter((r) => {
        const key = `${r.values.documentType}:${r.values.documentNumber}`;
        if (existingKeys.has(key)) {
          skipped.push({ row: r.row, errors: ["Ya existe un socio con este documento."] });
          return false;
        }
        return true;
      });

      if (toInsert.length) {
        await tx.insert(members).values(toInsert.map((r) => ({ ...r.values, orgId: org.id })));
        await audit(tx, {
          orgId: org.id,
          actorId: userId,
          action: "member.import",
          entity: "member",
          diff: { inserted: toInsert.length, skipped: skipped.length, file: file.name },
        });
      }

      skipped.sort((a, b) => a.row - b.row);
      return { inserted: toInsert.length, skipped };
    });

    revalidatePath(`/app/${orgSlug}/members`);
    return { ok: true, data: summary };
  } catch (err) {
    if (err instanceof ForbiddenError) return { ok: false, error: err.message };
    console.error(err);
    return { ok: false, error: "No pudimos importar el archivo. Intenta de nuevo." };
  }
}
