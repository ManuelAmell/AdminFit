import type { Metadata } from "next";
import { requireSuperadmin } from "@/lib/auth/session";
import { getPlatformSettings } from "@/modules/platform/queries";
import { BillingSettingsForm } from "./billing-settings-form";

export const metadata: Metadata = { title: "Datos de pago — Plataforma AdminFit" };

export default async function AdminBillingPage() {
  await requireSuperadmin();
  const settings = await getPlatformSettings();

  return <BillingSettingsForm settings={settings} />;
}
