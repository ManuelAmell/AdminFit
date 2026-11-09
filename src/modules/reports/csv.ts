import Papa from "papaparse";
import { formatCOP } from "@/lib/money";
import { PAYMENT_METHOD_LABELS, type PaymentMethod } from "@/modules/payments/constants";

export type ReportExportData = {
  orgName: string;
  dateRange: {
    fromISO: string;
    toISO: string;
    preset?: string;
  };
  summary: {
    totalRevenueCents: number;
    totalPayments: number;
    newMembersCount: number;
    renewalsCount: number;
    expirationsCount: number;
  };
  byPlan: Array<{
    planName: string;
    count: number;
    totalCents: number;
    percentage: number;
  }>;
  byMethod: Array<{
    method: PaymentMethod;
    count: number;
    totalCents: number;
    percentage: number;
  }>;
  paymentsDetail: Array<{
    receiptNumber: number;
    paidAtBogota: string;
    memberDocument: string;
    memberName: string;
    planName: string;
    method: PaymentMethod;
    reference?: string | null;
    amountCents: number;
  }>;
};

export function generateReportCsv(data: ReportExportData): string {
  const sections: string[] = [];

  // Metadatos y Encabezado
  const metaRows = [
    ["ADMINFIT — REPORTE DE GESTIÓN Y FINANZAS"],
    ["Gimnasio", data.orgName],
    ["Periodo", `${data.dateRange.fromISO} al ${data.dateRange.toISO}`],
    ["Fecha de Generación", new Date().toISOString().replace("T", " ").slice(0, 19)],
    [],
  ];
  sections.push(Papa.unparse(metaRows));

  // Resumen General (KPIs)
  const summaryRows = [
    ["RESUMEN GENERAL", ""],
    ["Total Recaudado", formatCOP(data.summary.totalRevenueCents)],
    ["Cantidad de Pagos", String(data.summary.totalPayments)],
    ["Altas de Socios", String(data.summary.newMembersCount)],
    ["Renovaciones", String(data.summary.renewalsCount)],
    ["Vencimientos en Periodo", String(data.summary.expirationsCount)],
    [],
  ];
  sections.push(Papa.unparse(summaryRows));

  // Ingresos por Plan
  const planRows = [
    ["INGRESOS POR PLAN", "", "", ""],
    ["Plan", "Cantidad de Pagos", "Total (COP)", "Participación (%)"],
    ...data.byPlan.map((p) => [
      p.planName,
      String(p.count),
      formatCOP(p.totalCents),
      `${p.percentage.toFixed(1)}%`,
    ]),
    [],
  ];
  sections.push(Papa.unparse(planRows));

  // Ingresos por Método de Pago
  const methodRows = [
    ["INGRESOS POR MÉTODO DE PAGO", "", "", ""],
    ["Método", "Cantidad de Pagos", "Total (COP)", "Participación (%)"],
    ...data.byMethod.map((m) => [
      PAYMENT_METHOD_LABELS[m.method] ?? m.method,
      String(m.count),
      formatCOP(m.totalCents),
      `${m.percentage.toFixed(1)}%`,
    ]),
    [],
  ];
  sections.push(Papa.unparse(methodRows));

  // Detalle de Pagos
  const detailRows = [
    ["DETALLE DE PAGOS EN EL PERIODO", "", "", "", "", "", "", ""],
    [
      "Recibo #",
      "Fecha / Hora (Bogotá)",
      "Documento",
      "Socio",
      "Plan",
      "Método",
      "Referencia",
      "Monto (COP)",
    ],
    ...data.paymentsDetail.map((d) => [
      String(d.receiptNumber),
      d.paidAtBogota,
      d.memberDocument,
      d.memberName,
      d.planName,
      PAYMENT_METHOD_LABELS[d.method] ?? d.method,
      d.reference || "-",
      formatCOP(d.amountCents),
    ]),
  ];
  sections.push(Papa.unparse(detailRows));

  // BOM UTF-8 para garantizar compatibilidad con Excel
  return "\uFEFF" + sections.join("\n\n");
}
