"use server";

import { ForbiddenError, requirePermission } from "@/lib/auth/authorize";
import { generateReportCsv } from "./csv";
import { getReportExportData } from "./queries";
import { reportFiltersSchema, type ReportFilters } from "./schema";

export type ActionResult<T = undefined> =
  { ok: true; data: T } | { ok: false; error: string; fieldErrors?: Record<string, string> };

export async function exportReportCsvAction(
  orgSlug: string,
  input: Partial<ReportFilters>,
): Promise<ActionResult<string>> {
  try {
    const ctx = await requirePermission(orgSlug, { report: ["export"] });
    const parsed = reportFiltersSchema.safeParse(input);
    const filters = parsed.success ? parsed.data : reportFiltersSchema.parse({});

    const exportData = await getReportExportData(ctx.org.id, filters);
    const csv = generateReportCsv(exportData);

    return { ok: true, data: csv };
  } catch (err) {
    if (err instanceof ForbiddenError) {
      return { ok: false, error: err.message };
    }
    console.error("Error al exportar reporte:", err);
    return { ok: false, error: "Ocurrió un error al generar el reporte en CSV." };
  }
}
