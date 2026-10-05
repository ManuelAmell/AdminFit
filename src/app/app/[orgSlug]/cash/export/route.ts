import { ForbiddenError, requirePermission } from "@/lib/auth/authorize";
import { todayISO } from "@/lib/dates";
import { centsToPesos } from "@/lib/money";
import {
  CASH_DAY_STATUS_LABELS,
  classifyDifference,
  parseCashRange,
  resolveCashRange,
} from "@/modules/cash/analytics";
import { listClosuresInRange } from "@/modules/cash/queries";

function csvEscape(v: string | number) {
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

// Historial de cierres del Centro de caja como CSV (mismo patrón que reports/export).
export async function GET(request: Request, { params }: { params: Promise<{ orgSlug: string }> }) {
  const { orgSlug } = await params;
  let ctx;
  try {
    ctx = await requirePermission(orgSlug, { cashClosure: ["readAll"], report: ["export"] });
  } catch (err) {
    if (err instanceof ForbiddenError) return new Response(err.message, { status: 403 });
    throw err;
  }

  // parseCashRange ya valida contra la lista cerrada de rangos (zod no aporta aquí).
  const range = parseCashRange(new URL(request.url).searchParams.get("range"));
  const { fromISO, toISO } = resolveCashRange(range, todayISO());
  const { closures } = await listClosuresInRange(ctx.org.id, fromISO, toISO);

  const rows: (string | number)[][] = [
    ["Fecha", "Sede", "Cerró", "Base", "Esperado", "Contado", "Diferencia", "Estado", "Notas"],
  ];
  for (const c of closures) {
    rows.push([
      c.businessDate,
      c.branchName ?? "",
      c.closedByName ?? "",
      centsToPesos(c.openingCashCents),
      centsToPesos(c.expectedCashCents),
      centsToPesos(c.countedCashCents),
      centsToPesos(c.differenceCents),
      CASH_DAY_STATUS_LABELS[classifyDifference(c.differenceCents)],
      c.notes ?? "",
    ]);
  }
  // BOM para que Excel abra el UTF-8 (tildes) correctamente.
  const csv = "﻿" + rows.map((r) => r.map(csvEscape).join(",")).join("\n");
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="cierres-${fromISO}_${toISO}.csv"`,
    },
  });
}
