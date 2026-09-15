import type { Metadata } from "next";
import { Upload, UserPlus } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { DataTableSkeleton } from "@/components/data-table/data-table";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { roleCan } from "@/lib/auth/authorize";
import { requireOrg } from "@/lib/auth/session";
import { listMembers } from "@/modules/members/queries";
import { listMembersParamsSchema } from "@/modules/members/schema";
import { MembersTable } from "./members-table";

export const metadata: Metadata = { title: "Socios — AdminFit" };

export default async function MembersPage(props: PageProps<"/app/[orgSlug]/members">) {
  const { orgSlug } = await props.params;
  const sp = await props.searchParams;
  const { org, role, isSuperadmin } = await requireOrg(orgSlug);
  const params = listMembersParamsSchema.parse({
    q: sp.q,
    status: sp.status,
    sort: sp.sort,
    dir: sp.dir,
    page: sp.page,
    pageSize: sp.pageSize,
  });
  const canCreate = isSuperadmin || roleCan(role, { gymMember: ["create"] });
  const canImport = isSuperadmin || roleCan(role, { gymMember: ["import"] });
  const base = `/app/${org.slug}/members`;

  return (
    <>
      <PageHeader
        title="Socios"
        description={org.name}
        actions={
          <>
            {canImport && (
              <Button
                variant="outline"
                className="h-9"
                nativeButton={false}
                render={<Link href={`${base}/import`} />}
              >
                <Upload data-icon="inline-start" />
                <span className="hidden sm:inline">Importar CSV</span>
                <span className="sm:hidden">CSV</span>
              </Button>
            )}
            {canCreate && (
              <Button className="h-9" nativeButton={false} render={<Link href={`${base}/new`} />}>
                <UserPlus data-icon="inline-start" />
                <span className="hidden sm:inline">Nuevo socio</span>
                <span className="sm:hidden">Nuevo</span>
              </Button>
            )}
          </>
        }
      />
      <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
        <Suspense fallback={<DataTableSkeleton columns={5} />}>
          <MembersList orgId={org.id} orgSlug={org.slug} params={params} />
        </Suspense>
      </div>
    </>
  );
}

async function MembersList({
  orgId,
  orgSlug,
  params,
}: {
  orgId: string;
  orgSlug: string;
  params: ReturnType<typeof listMembersParamsSchema.parse>;
}) {
  const result = await listMembers(orgId, params);
  return <MembersTable orgSlug={orgSlug} rows={result.data} total={result.total} params={params} />;
}
