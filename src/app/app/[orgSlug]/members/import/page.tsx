import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { requirePermission } from "@/lib/auth/authorize";
import { ImportForm } from "./import-form";

export const metadata: Metadata = { title: "Importar socios — AdminFit" };

export default async function ImportMembersPage({
  params,
}: PageProps<"/app/[orgSlug]/members/import">) {
  const { orgSlug } = await params;
  const { org } = await requirePermission(orgSlug, { gymMember: ["import"] });

  return (
    <>
      <PageHeader title="Importar socios" description="Carga masiva desde un archivo CSV" />
      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 p-4 md:p-6">
        <ImportForm orgSlug={org.slug} />
      </div>
    </>
  );
}
