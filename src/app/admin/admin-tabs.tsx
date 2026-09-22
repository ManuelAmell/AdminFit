"use client";

import { usePathname, useRouter } from "next/navigation";
import AnimatedTabs from "@/components/smoothui/animated-tabs";

export function AdminTabs() {
  const pathname = usePathname();
  const router = useRouter();

  const activeTab = pathname.startsWith("/admin/plans")
    ? "plans"
    : pathname.startsWith("/admin/billing")
      ? "billing"
      : "gyms";

  return (
    <AnimatedTabs
      activeTab={activeTab}
      className="mb-2"
      onChange={(tabId) => {
        router.push(`/admin/${tabId}`);
      }}
      tabs={[
        { id: "gyms", label: "Gimnasios" },
        { id: "plans", label: "Planes SaaS" },
        { id: "billing", label: "Datos de pago" },
      ]}
    />
  );
}
