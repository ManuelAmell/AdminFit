import { describe, expect, it } from "vitest";
import { generateReportCsv, type ReportExportData } from "@/modules/reports/csv";

describe("generateReportCsv", () => {
  const sampleData: ReportExportData = {
    orgName: "Gimnasio Titán",
    dateRange: {
      fromISO: "2026-03-01",
      toISO: "2026-03-31",
      preset: "month",
    },
    summary: {
      totalRevenueCents: 250000000, // $ 2.500.000 COP
      totalPayments: 15,
      newMembersCount: 8,
      renewalsCount: 5,
      expirationsCount: 6,
    },
    byPlan: [
      {
        planName: "Plan Mensual",
        count: 10,
        totalCents: 150000000,
        percentage: 60,
      },
      {
        planName: "Plan Trimestral",
        count: 5,
        totalCents: 100000000,
        percentage: 40,
      },
    ],
    byMethod: [
      {
        method: "transfer",
        count: 10,
        totalCents: 180000000,
        percentage: 72,
      },
      {
        method: "cash",
        count: 5,
        totalCents: 70000000,
        percentage: 28,
      },
    ],
    paymentsDetail: [
      {
        receiptNumber: 101,
        paidAtBogota: "2026-03-05 10:30",
        memberDocument: "10203040",
        memberName: "Carlos Rodríguez",
        planName: "Plan Mensual",
        method: "transfer",
        reference: "NEQUI-9876",
        amountCents: 15000000,
      },
    ],
  };

  it("incluye el BOM UTF-8 al inicio para Excel", () => {
    const csv = generateReportCsv(sampleData);
    expect(csv.startsWith("\uFEFF")).toBe(true);
  });

  it("incluye el encabezado y metadatos de la organización y rango", () => {
    const csv = generateReportCsv(sampleData);
    expect(csv).toContain("Gimnasio Titán");
    expect(csv).toContain("2026-03-01");
    expect(csv).toContain("2026-03-31");
  });

  it("formatea métodos de pago a español amigable", () => {
    const csv = generateReportCsv(sampleData);
    expect(csv).toContain("Transferencia");
    expect(csv).toContain("Efectivo");
  });

  it("contiene los datos del resumen, planes y detalle de pagos", () => {
    const csv = generateReportCsv(sampleData);
    expect(csv).toContain("Carlos Rodríguez");
    expect(csv).toContain("NEQUI-9876");
    expect(csv).toContain("Plan Mensual");
    expect(csv).toContain("Plan Trimestral");
  });
});
