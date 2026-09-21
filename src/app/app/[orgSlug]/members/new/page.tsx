import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { requirePermission } from "@/lib/auth/authorize";
import { listBranches } from "@/modules/members/queries";
import { MemberForm } from "../member-form";

export const metadata: Metadata = { title: "Nuevo socio — AdminFit" };

export default async function NewMemberPage({ params }: PageProps<"/app/[orgSlug]/members/new">) {
  const { orgSlug } = await params;
  const { org } = await requirePermission(orgSlug, { gymMember: ["create"] });
  const branches = await listBranches(org.id);

  return (
    <>
      <PageHeader title="Nuevo socio" description="Registra la ficha del socio" />
      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 p-4 md:p-6">
        <MemberForm orgSlug={org.slug} branches={branches} />
      </div>
    </>
  );
}
