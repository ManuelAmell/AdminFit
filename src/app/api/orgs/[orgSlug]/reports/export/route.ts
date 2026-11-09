import { type NextRequest, NextResponse } from "next/server";
import { ForbiddenError, requirePermission } from "@/lib/auth/authorize";
import { generateReportCsv } from "@/modules/reports/csv";
import { getReportExportData } from "@/modules/reports/queries";
import { reportFiltersSchema } from "@/modules/reports/schema";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orgSlug: string }> },
) {
  const { orgSlug } = await params;

  try {
    const ctx = await requirePermission(orgSlug, { report: ["export"] });
    const { searchParams } = request.nextUrl;

    const parsed = reportFiltersSchema.safeParse({
      range: searchParams.get("range") ?? undefined,
      from: searchParams.get("from") ?? undefined,
      to: searchParams.get("to") ?? undefined,
    });
    const filters = parsed.success ? parsed.data : reportFiltersSchema.parse({});

    const exportData = await getReportExportData(ctx.org.id, filters);
    const csv = generateReportCsv(exportData);

    const filename = `reporte-${orgSlug}-${exportData.dateRange.fromISO}-${exportData.dateRange.toISO}.csv`;

    return new Response(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store, max-age=0",
      },
    });
  } catch (err) {
    if (err instanceof ForbiddenError) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    console.error("Error en route handler de exportación de reporte:", err);
    return NextResponse.json({ error: "Error interno al exportar reporte" }, { status: 500 });
  }
}
