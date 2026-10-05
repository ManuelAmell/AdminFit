import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { can, requirePermission } from "@/lib/auth/authorize";
import { listBranches } from "@/modules/members/queries";
import { NewExpenseForm } from "./new-expense-form";

export const metadata: Metadata = { title: "Nuevo gasto — AdminFit" };

export default async function NewExpensePage(props: PageProps<"/app/[orgSlug]/expenses/new">) {
  const { orgSlug } = await props.params;
  const ctx = await requirePermission(orgSlug, { expense: ["create"] });
  const { org } = ctx;
  const branches = await listBranches(org.id);
  const canRecordPayroll = can(ctx, { expense: ["readPayroll"] });

  return (
    <>
      <PageHeader title="Nuevo gasto" description="Arriendo, servicios, equipo, insumos…" />
      <div className="flex flex-1 flex-col p-4 md:p-6">
        <Card className="mx-auto w-full max-w-2xl">
          <CardContent className="pt-6">
            <NewExpenseForm
              orgSlug={org.slug}
              branches={branches}
              canRecordPayroll={canRecordPayroll}
            />
          </CardContent>
        </Card>
      </div>
    </>
  );
}
