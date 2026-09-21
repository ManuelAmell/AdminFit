import type { Metadata } from "next";
import { and, eq, isNull } from "drizzle-orm";
import { members } from "@/db/schema";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { requirePermission } from "@/lib/auth/authorize";
import { withTenant } from "@/lib/tenant";
import type { PickedMember } from "@/components/forms/member-picker";
import { NewPaymentForm } from "./new-payment-form";

export const metadata: Metadata = { title: "Registrar pago — AdminFit" };

export default async function NewPaymentPage(props: PageProps<"/app/[orgSlug]/payments/new">) {
  const { orgSlug } = await props.params;
  const { memberId } = await props.searchParams;
  const { org } = await requirePermission(orgSlug, { payment: ["create"] });

  let initialMember: PickedMember | null = null;
  if (typeof memberId === "string" && /^[0-9a-f-]{36}$/i.test(memberId)) {
    initialMember = await withTenant(org.id, async (tx) => {
      const [m] = await tx
        .select({
          id: members.id,
          firstName: members.firstName,
          lastName: members.lastName,
          documentType: members.documentType,
          documentNumber: members.documentNumber,
          status: members.status,
        })
        .from(members)
        .where(and(eq(members.id, memberId), isNull(members.deletedAt)))
        .limit(1);
      return m ?? null;
    });
  }

  return (
    <>
      <PageHeader title="Registrar pago" description="Efectivo, transferencia o tarjeta" />
      <div className="flex flex-1 flex-col p-4 md:p-6">
        <Card className="mx-auto w-full max-w-2xl">
          <CardContent className="pt-6">
            <NewPaymentForm orgSlug={org.slug} initialMember={initialMember} />
          </CardContent>
        </Card>
      </div>
    </>
  );
}
