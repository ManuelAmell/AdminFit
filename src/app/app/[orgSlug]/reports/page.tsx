import type { Metadata } from "next";
import { Download } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { can, requirePermission } from "@/lib/auth/authorize";
import { currentMonthISO } from "@/lib/dates";
import { getMonthlySummary } from "@/modules/reports/queries";
import { ReportsMonthPicker } from "./month-picker";
import { ReportsTabs } from "./reports-tabs";

export const metadata: Metadata = { title: "Reportes — AdminFit" };

export default async function ReportsPage(props: PageProps<"/app/[orgSlug]/reports">) {
  const { orgSlug } = await props.params;
  const { month } = await props.searchParams;
  const ctx = await requirePermission(orgSlug, { report: ["read"] });
  const { org } = ctx;
  const canExport = can(ctx, { report: ["export"] });
  const canReadPayroll = can(ctx, { expense: ["readPayroll"] });

  const monthISO =
    typeof month === "string" && /^\d{4}-\d{2}$/.test(month) ? month : currentMonthISO();
  const summary = await getMonthlySummary(org.id, monthISO, !canReadPayroll);

  return (
    <>
      <PageHeader
        title="Reportes"
        description={org.name}
        actions={
          <>
            <ReportsMonthPicker month={monthISO} />
            {canExport && (
              <Button
                variant="outline"
                size="sm"
                className="h-9"
                nativeButton={false}
                render={<a href={`/app/${org.slug}/reports/export?month=${monthISO}`} download />}
              >
                <Download data-icon="inline-start" />
                <span className="hidden sm:inline">Exportar CSV</span>
              </Button>
            )}
          </>
        }
      />
      <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
        {!canReadPayroll && (
          <p className="text-muted-foreground text-sm">
            Los gastos de nómina no están incluidos en este reporte.
          </p>
        )}
        <ReportsTabs summary={summary} />
      </div>
    </>
  );
}
