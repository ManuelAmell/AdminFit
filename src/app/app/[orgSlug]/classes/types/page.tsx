import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { requireOrg } from "@/lib/auth/session";
import { listClassTypes } from "@/modules/classes/queries";
import { ClassesTabs } from "../classes-tabs";
import { ClassTypeDialog } from "./class-type-dialog";
import { ClassTypesTable } from "./class-types-table";

export const metadata: Metadata = { title: "Modalidades de Clase — AdminFit" };

export default async function ClassTypesPage({
  params,
}: PageProps<"/app/[orgSlug]/classes/types">) {
  const { orgSlug } = await params;
  const { org, role, isSuperadmin } = await requireOrg(orgSlug);

  const classTypes = await listClassTypes(org.id);
  const canManage = isSuperadmin || role === "owner" || role === "admin" || role === "staff";

  return (
    <>
      <PageHeader
        title="Modalidades de Clase"
        description="Tipos de clases, aforos y configuraciones para programación de sesiones."
        actions={canManage && classTypes.length > 0 ? <ClassTypeDialog orgSlug={org.slug} /> : null}
      />
      <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
        <ClassesTabs orgSlug={org.slug} active="types" />
        <ClassTypesTable orgSlug={org.slug} classTypes={classTypes} canManage={canManage} />
      </div>
    </>
  );
}
