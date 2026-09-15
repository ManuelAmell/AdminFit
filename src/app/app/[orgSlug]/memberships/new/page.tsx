import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { roleCan } from "@/lib/auth/authorize";
import { requireOrg } from "@/lib/auth/session";
import { todayISO } from "@/lib/dates";
import { listActivePlans } from "@/modules/plans/queries";
import { getMemberPick } from "@/modules/subscriptions/queries";
import { SellForm } from "./sell-form";

export const metadata: Metadata = { title: "Vender membresía — AdminFit" };

export default async function NewMembershipPage(
  props: PageProps<"/app/[orgSlug]/memberships/new">,
) {
  const [{ orgSlug }, sp] = await Promise.all([props.params, props.searchParams]);
  const { org, role, isSuperadmin } = await requireOrg(orgSlug);
  if (!isSuperadmin && !roleCan(role, { subscription: ["create"] })) notFound();

  const memberId = typeof sp.member === "string" ? sp.member : undefined;
  const [plans, preselected] = await Promise.all([
    listActivePlans(org.id),
    memberId ? getMemberPick(org.id, memberId) : Promise.resolve(null),
  ]);

  return (
    <>
      <PageHeader title="Vender membresía" description="Elige socio, plan y fecha de inicio" />
      <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
        <SellForm
          orgSlug={orgSlug}
          plans={plans.map((p) => ({
            id: p.id,
            name: p.name,
            priceCents: p.priceCents,
            durationType: p.durationType,
            durationValue: p.durationValue,
            visitLimit: p.visitLimit,
            color: p.color,
          }))}
          preselectedMember={preselected}
          today={todayISO(org.timezone ?? undefined)}
        />
      </div>
    </>
  );
}
