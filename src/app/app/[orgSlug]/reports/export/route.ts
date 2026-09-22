import { z } from "zod";
import { can, ForbiddenError, requirePermission } from "@/lib/auth/authorize";
import { currentMonthISO } from "@/lib/dates";
import { centsToPesos } from "@/lib/money";
import { EXPENSE_CATEGORY_LABELS } from "@/modules/expenses/constants";
import { PAYMENT_CONCEPT_LABELS, PAYMENT_METHOD_LABELS } from "@/modules/payments/constants";
import { getMonthlySummary } from "@/modules/reports/queries";

const querySchema = z.object({
  month: z
    .string()
    .regex(/^\d{4}-\d{2}$/)
    .optional(),
});

function csvEscape(v: string | number) {
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export async function GET(request: Request, { params }: { params: Promise<{ orgSlug: string }> }) {
  const { orgSlug } = await params;
  let ctx;
  try {
    ctx = await requirePermission(orgSlug, { report: ["export"] });
  } catch (err) {
    if (err instanceof ForbiddenError) {
      return new Response(err.message, { status: 403 });
    }
    throw err;
  }

  const parsed = querySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  const monthISO = parsed.success && parsed.data.month ? parsed.data.month : currentMonthISO();
  const excludePayroll = !can(ctx, { expense: ["readPayroll"] });
  const summary = await getMonthlySummary(ctx.org.id, monthISO, excludePayroll);

  const rows: string[][] = [["Sección", "Concepto", "Monto (COP)"]];
  for (const r of summary.incomeByConcept) {
    rows.push([
      "Ingresos por concepto",
      PAYMENT_CONCEPT_LABELS[r.concept],
      String(centsToPesos(r.cents)),
    ]);
  }
  for (const r of summary.incomeByMethod) {
    rows.push([
      "Ingresos por método",
      PAYMENT_METHOD_LABELS[r.method],
      String(centsToPesos(r.cents)),
    ]);
  }
  for (const r of summary.expensesByCategory) {
    rows.push([
      "Gastos por categoría",
      EXPENSE_CATEGORY_LABELS[r.category],
      String(centsToPesos(r.cents)),
    ]);
  }
  rows.push(["Total", "Ingresos", String(centsToPesos(summary.incomeTotal))]);
  rows.push(["Total", "Gastos", String(centsToPesos(summary.expensesTotal))]);
  rows.push(["Total", "Utilidad", String(centsToPesos(summary.profitCents))]);

  const csv = rows.map((r) => r.map(csvEscape).join(",")).join("\n");

  return new Response("﻿" + csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="reporte-${monthISO}.csv"`,
    },
  });
}
