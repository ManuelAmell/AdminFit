import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { requireOrg } from "@/lib/auth/session";
import { listBranchesWithStats } from "@/modules/branches/queries";
import { SettingsTabs } from "../settings-tabs";
import { BranchDialog } from "./branch-dialog";
import { BranchesTable } from "./branches-table";

export const metadata: Metadata = { title: "Sedes — AdminFit" };

export default async function BranchesPage({
  params,
}: PageProps<"/app/[orgSlug]/settings/branches">) {
  const { orgSlug } = await params;
  const { org, role, isSuperadmin } = await requireOrg(orgSlug);

  const branches = await listBranchesWithStats(org.id);
  const canManage = isSuperadmin || role === "owner" || role === "admin";

  return (
    <>
      <PageHeader
        title="Configuración"
        description={org.name}
        actions={canManage && branches.length > 0 ? <BranchDialog orgSlug={org.slug} /> : null}
      />
      <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
        <SettingsTabs orgSlug={org.slug} active="branches" />
        <BranchesTable orgSlug={org.slug} branches={branches} canManage={canManage} />
      </div>
    </>
  );
}
