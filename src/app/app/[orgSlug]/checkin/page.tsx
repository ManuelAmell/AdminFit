import type { Metadata } from "next";
import { CheckCircle2, ScanLine, XCircle } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { requireOrg } from "@/lib/auth/session";
import { listBranchesWithStats } from "@/modules/branches/queries";
import { getCheckinStatsToday, listRecentCheckins } from "@/modules/checkins/queries";
import { CheckinKiosk } from "./checkin-kiosk";

export const metadata: Metadata = { title: "Check-in — AdminFit" };

export default async function CheckinPage({ params }: PageProps<"/app/[orgSlug]/checkin">) {
  const { orgSlug } = await params;
  const { org } = await requireOrg(orgSlug);

  const [branches, recentCheckins, stats] = await Promise.all([
    listBranchesWithStats(org.id),
    listRecentCheckins(org.id, 40),
    getCheckinStatsToday(org.id),
  ]);

  return (
    <>
      <PageHeader title="Control de acceso" description={`Terminal de check-in para ${org.name}`} />

      <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
        {/* Estadísticas de hoy */}
        <section aria-label="Estadísticas de ingresos hoy" className="grid gap-4 sm:grid-cols-3">
          <Card className="py-3">
            <CardHeader className="flex flex-row items-center justify-between pb-1">
              <span className="text-muted-foreground text-xs font-medium">Total ingresos hoy</span>
              <ScanLine className="text-muted-foreground size-4" />
            </CardHeader>
            <CardContent className="pt-0">
              <div className="text-2xl font-bold tabular-nums">{stats.total}</div>
            </CardContent>
          </Card>

          <Card className="py-3">
            <CardHeader className="flex flex-row items-center justify-between pb-1">
              <span className="text-muted-foreground text-xs font-medium">Accesos concedidos</span>
              <CheckCircle2 className="size-4 text-emerald-500" />
            </CardHeader>
            <CardContent className="pt-0">
              <div className="text-2xl font-bold text-emerald-600 tabular-nums dark:text-emerald-400">
                {stats.granted}
              </div>
            </CardContent>
          </Card>

          <Card className="py-3">
            <CardHeader className="flex flex-row items-center justify-between pb-1">
              <span className="text-muted-foreground text-xs font-medium">Accesos denegados</span>
              <XCircle className="text-destructive size-4" />
            </CardHeader>
            <CardContent className="pt-0">
              <div className="text-destructive text-2xl font-bold tabular-nums">
                {stats.rejected}
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Terminal interactiva de recepción */}
        <CheckinKiosk
          orgSlug={org.slug}
          branches={branches.map((b) => ({ id: b.id, name: b.name }))}
          initialRecent={recentCheckins}
        />
      </div>
    </>
  );
}
