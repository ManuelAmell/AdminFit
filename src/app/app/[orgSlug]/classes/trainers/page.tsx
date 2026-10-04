import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { requireOrg } from "@/lib/auth/session";
import { listTrainers } from "@/modules/classes/queries";
import { ClassesTabs } from "../classes-tabs";
import { TrainerDialog } from "./trainer-dialog";
import { TrainersTable } from "./trainers-table";

export const metadata: Metadata = { title: "Entrenadores — AdminFit" };

export default async function TrainersPage({
  params,
}: PageProps<"/app/[orgSlug]/classes/trainers">) {
  const { orgSlug } = await params;
  const { org, role, isSuperadmin } = await requireOrg(orgSlug);

  const trainers = await listTrainers(org.id);
  const canManage = isSuperadmin || role === "owner" || role === "admin" || role === "staff";

  return (
    <>
      <PageHeader
        title="Entrenadores"
        description="Instructores y coaches asignables a los horarios de clase."
        actions={canManage && trainers.length > 0 ? <TrainerDialog orgSlug={org.slug} /> : null}
      />
      <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
        <ClassesTabs orgSlug={org.slug} active="trainers" />
        <TrainersTable orgSlug={org.slug} trainers={trainers} canManage={canManage} />
      </div>
    </>
  );
}
