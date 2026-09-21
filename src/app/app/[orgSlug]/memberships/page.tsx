import type { Metadata } from "next";
import { Plus } from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { roleCan } from "@/lib/auth/authorize";
import { requireOrg } from "@/lib/auth/session";
import { listActivePlans } from "@/modules/plans/queries";
import { listSubscriptions } from "@/modules/subscriptions/queries";
import { SUBSCRIPTION_FILTERS, type SubscriptionFilter } from "@/modules/subscriptions/schema";
import { MembershipsFilters } from "./memberships-filters";
import { MembershipsTable } from "./memberships-table";

export const metadata: Metadata = { title: "Membresías — AdminFit" };

export default async function MembershipsPage(props: PageProps<"/app/[orgSlug]/memberships">) {
  const [{ orgSlug }, sp] = await Promise.all([props.params, props.searchParams]);
  const { org, role, isSuperadmin } = await requireOrg(orgSlug);

  const filterParam = typeof sp.filter === "string" ? sp.filter : "all";
  const filter = (SUBSCRIPTION_FILTERS as readonly string[]).includes(filterParam)
    ? (filterParam as SubscriptionFilter)
    : "all";
  const planId = typeof sp.plan === "string" && sp.plan ? sp.plan : undefined;
  const q = typeof sp.q === "string" ? sp.q : undefined;
  const page = typeof sp.page === "string" ? Number(sp.page) || 1 : 1;

  const [result, plans] = await Promise.all([
    listSubscriptions(org.id, { filter, planId, q, page }),
    listActivePlans(org.id),
  ]);

  const can = {
    sell: isSuperadmin || roleCan(role, { subscription: ["create"] }),
    renew: isSuperadmin || roleCan(role, { subscription: ["renew"] }),
    freeze: isSuperadmin || roleCan(role, { subscription: ["freeze"] }),
    cancel: isSuperadmin || roleCan(role, { subscription: ["cancel"] }),
  };

  return (
    <>
      <PageHeader
        title="Membresías"
        description={`${result.counts.active} ${result.counts.active === 1 ? "activa" : "activas"} · ${result.counts.expiring} por vencer`}
        actions={
          can.sell ? (
            <Button
              size="lg"
              className="h-9"
              nativeButton={false}
              render={<Link href={`/app/${orgSlug}/memberships/new`} />}
            >
              <Plus data-icon="inline-start" />
              Vender membresía
            </Button>
          ) : undefined
        }
      />
      <div className="flex flex-1 flex-col gap-4 p-4 md:p-6">
        <MembershipsFilters
          orgSlug={orgSlug}
          filter={filter}
          planId={planId}
          q={q}
          counts={result.counts}
          plans={plans.map((p) => ({ id: p.id, name: p.name }))}
        />
        <MembershipsTable
          orgSlug={orgSlug}
          result={result}
          plans={plans.map((p) => ({ id: p.id, name: p.name }))}
          can={can}
        />
      </div>
    </>
  );
}
