import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { requirePermission } from "@/lib/auth/authorize";
import { centsToPesos, formatPesosLive } from "@/lib/money";
import { getOrgReceiptInfo } from "@/modules/payments/queries";
import { QuickSaleForm } from "./quick-sale-form";

export const metadata: Metadata = { title: "Venta rápida — AdminFit" };

export default async function QuickSalePage(props: PageProps<"/app/[orgSlug]/payments/quick">) {
  const { orgSlug } = await props.params;
  const { org } = await requirePermission(orgSlug, { payment: ["create"] });
  const { settings } = await getOrgReceiptInfo(org.id);
  const dayPassPriceFormatted = settings?.dayPassPriceCents
    ? formatPesosLive(String(centsToPesos(settings.dayPassPriceCents)))
    : "";

  return (
    <>
      <PageHeader
        title="Venta rápida"
        description="Pase del día, producto u otro cobro sin membresía"
      />
      <div className="flex flex-1 flex-col p-4 md:p-6">
        <Card className="mx-auto w-full max-w-2xl">
          <CardContent className="pt-6">
            <QuickSaleForm orgSlug={org.slug} dayPassPriceFormatted={dayPassPriceFormatted} />
          </CardContent>
        </Card>
      </div>
    </>
  );
}
