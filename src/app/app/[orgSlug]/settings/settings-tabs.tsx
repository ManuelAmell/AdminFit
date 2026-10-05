"use client";

import { usePathname, useRouter } from "next/navigation";
import AnimatedTabs from "@/components/smoothui/animated-tabs";

export function SettingsTabs({ orgSlug, isOwner = false }: { orgSlug: string; isOwner?: boolean }) {
  const pathname = usePathname();
  const router = useRouter();
  const base = `/app/${orgSlug}/settings`;
  const activeTab = pathname.startsWith(`${base}/plan`)
    ? "plan"
    : pathname.startsWith(`${base}/team`)
      ? "team"
      : "general";

  const tabs = [
    { id: "general", label: "General" },
    { id: "team", label: "Equipo" },
  ];

  if (isOwner) {
    tabs.push({ id: "plan", label: "Mi plan" });
  }

  return (
    <AnimatedTabs
      activeTab={activeTab}
      className="mb-2"
      onChange={(tabId) => router.push(`${base}/${tabId}`)}
      tabs={tabs}
    />
  );
}
