import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { requireOrg } from "@/lib/auth/session";
import { todayISO } from "@/lib/dates";
import { listBranchesWithStats } from "@/modules/branches/queries";
import { listClassSessions, listClassTypes, listTrainers } from "@/modules/classes/queries";
import { ClassesTabs } from "./classes-tabs";
import { ScheduleFilter } from "./schedule-filter";
import { SessionDialog } from "./session-dialog";
import { SessionsView } from "./sessions-view";

export const metadata: Metadata = { title: "Clases y Horarios — AdminFit" };

export default async function ClassesPage({
  params,
  searchParams,
}: PageProps<"/app/[orgSlug]/classes">) {
  const { orgSlug } = await params;
  const resolvedSearchParams = (await searchParams) ?? {};
  const filterDate =
    typeof resolvedSearchParams.date === "string" ? resolvedSearchParams.date : undefined;
  const filterTypeId =
    typeof resolvedSearchParams.classTypeId === "string"
      ? resolvedSearchParams.classTypeId
      : undefined;
  const filterTrainerId =
    typeof resolvedSearchParams.trainerId === "string" ? resolvedSearchParams.trainerId : undefined;

  const { org, role, isSuperadmin } = await requireOrg(orgSlug);

  const [classTypes, trainers, branches, sessions] = await Promise.all([
    listClassTypes(org.id, true),
    listTrainers(org.id, true),
    listBranchesWithStats(org.id),
    listClassSessions(org.id, {
      startDate: filterDate || todayISO(),
      endDate: filterDate ? filterDate : undefined,
      classTypeId: filterTypeId,
      trainerId: filterTrainerId,
    }),
  ]);

  const canManage = isSuperadmin || role === "owner" || role === "admin" || role === "staff";

  return (
    <>
      <PageHeader
        title="Clases y Horarios"
        description="Programación semanal, aforo y reservas de clases grupales."
        actions={
          canManage && classTypes.length > 0 ? (
            <SessionDialog
              orgSlug={org.slug}
              classTypes={classTypes}
              trainers={trainers}
              branches={branches.map((b) => ({ id: b.id, name: b.name }))}
              defaultDate={filterDate || todayISO()}
            />
          ) : null
        }
      />
      <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
        <ClassesTabs orgSlug={org.slug} active="schedule" />

        {classTypes.length === 0 ? (
          <div className="border-border/60 bg-muted/20 flex flex-col items-center justify-center rounded-lg border border-dashed py-16 text-center">
            <h3 className="text-foreground text-base font-medium">
              Configura tus modalidades primero
            </h3>
            <p className="text-muted-foreground mt-1 max-w-sm text-sm">
              Para programar clases grupales, primero debes registrar al menos una modalidad (ej.
              Spinning, Yoga, Hiit).
            </p>
            <div className="mt-4">
              <ClassesTabs orgSlug={org.slug} active="types" />
            </div>
          </div>
        ) : (
          <>
            <ScheduleFilter orgSlug={org.slug} classTypes={classTypes} trainers={trainers} />

            <SessionsView orgSlug={org.slug} sessions={sessions} canManage={canManage} />
          </>
        )}
      </div>
    </>
  );
}
