"use client";

import { usePathname, useRouter } from "next/navigation";
import AnimatedTabs from "@/components/smoothui/animated-tabs";

// Navegación entre las subpáginas de Configuración (cada una su propio Server Component,
// no pestañas que ocultan/muestran contenido en el cliente): AnimatedTabs solo decide
// el destino y router.push hace la navegación real.
export function SettingsTabs({ orgSlug }: { orgSlug: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const base = `/app/${orgSlug}/settings`;
  const activeTab = pathname.startsWith(`${base}/team`) ? "team" : "general";

  return (
    <AnimatedTabs
      activeTab={activeTab}
      className="mb-2"
      onChange={(tabId) => router.push(`${base}/${tabId}`)}
      tabs={[
        { id: "general", label: "General" },
        { id: "team", label: "Equipo" },
      ]}
    />
  );
}
