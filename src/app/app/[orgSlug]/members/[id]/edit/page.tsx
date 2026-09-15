import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { requirePermission } from "@/lib/auth/authorize";
import { getMember, listBranches } from "@/modules/members/queries";
import { MemberForm } from "../../member-form";

export const metadata: Metadata = { title: "Editar socio — AdminFit" };

export default async function EditMemberPage({
  params,
}: PageProps<"/app/[orgSlug]/members/[id]/edit">) {
  const { orgSlug, id } = await params;
  const { org } = await requirePermission(orgSlug, { gymMember: ["update"] });
  const [result, branches] = await Promise.all([getMember(org.id, id), listBranches(org.id)]);
  if (!result) notFound();
  const m = result.member;

  return (
    <>
      <PageHeader title="Editar socio" description={`${m.firstName} ${m.lastName}`} />
      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 p-4 md:p-6">
        <MemberForm
          orgSlug={org.slug}
          memberId={m.id}
          branches={branches}
          defaultValues={{
            documentType: m.documentType,
            documentNumber: m.documentNumber,
            firstName: m.firstName,
            lastName: m.lastName,
            email: m.email ?? "",
            phone: m.phone ?? "",
            birthDate: m.birthDate ?? "",
            gender: m.gender,
            emergencyContactName: m.emergencyContactName ?? "",
            emergencyContactPhone: m.emergencyContactPhone ?? "",
            notes: m.notes ?? "",
            branchId: m.branchId,
          }}
        />
      </div>
    </>
  );
}
