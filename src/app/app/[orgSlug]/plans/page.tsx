import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { roleCan } from "@/lib/auth/authorize";
import { requireOrg } from "@/lib/auth/session";
import { listPlans } from "@/modules/plans/queries";
import { PlanDialog } from "./plan-dialog";
import { PlansTable } from "./plans-table";

export const metadata: Metadata = { title: "Planes — AdminFit" };

export default async function PlansPage({ params }: PageProps<"/app/[orgSlug]/plans">) {
  const { orgSlug } = await params;
  const { org, role, isSuperadmin } = await requireOrg(orgSlug);
  const plans = await listPlans(org.id);
  const canManage = isSuperadmin || roleCan(role, { plan: ["create", "update"] });

  return (
    <>
      <PageHeader
        title="Planes"
        description="Catálogo de membresías que vendes"
        actions={canManage ? <PlanDialog orgSlug={orgSlug} /> : undefined}
      />
      <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
        <PlansTable orgSlug={orgSlug} plans={plans} canManage={canManage} />
      </div>
    </>
  );
}
