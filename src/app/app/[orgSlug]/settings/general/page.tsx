import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requirePermission } from "@/lib/auth/authorize";
import { centsToPesos, formatPesosLive } from "@/lib/money";
import { getOrgReceiptInfo } from "@/modules/payments/queries";
import { SettingsTabs } from "../settings-tabs";
import { GeneralSettingsForm } from "./general-settings-form";

export const metadata: Metadata = { title: "Configuración — AdminFit" };

export default async function GeneralSettingsPage(
  props: PageProps<"/app/[orgSlug]/settings/general">,
) {
  const { orgSlug } = await props.params;
  const { org, role } = await requirePermission(orgSlug, { settings: ["read"] });
  const { settings } = await getOrgReceiptInfo(org.id);
  const initialDayPassPrice = settings?.dayPassPriceCents
    ? formatPesosLive(String(centsToPesos(settings.dayPassPriceCents)))
    : "";

  return (
    <>
      <PageHeader title="Configuración" description={org.name} />
      <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
        <SettingsTabs orgSlug={org.slug} isOwner={role === "owner"} />
        <Card className="max-w-2xl">
          <CardHeader>
            <CardTitle role="heading" aria-level={2}>
              Venta rápida
            </CardTitle>
            <CardDescription>Precios usados al vender sin membresía.</CardDescription>
          </CardHeader>
          <CardContent>
            <GeneralSettingsForm orgSlug={org.slug} initialDayPassPrice={initialDayPassPrice} />
          </CardContent>
        </Card>
      </div>
    </>
  );
}
