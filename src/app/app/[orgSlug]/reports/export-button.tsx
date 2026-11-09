"use client";

import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ExportButton({
  orgSlug,
  range,
  from,
  to,
  canExport,
}: {
  orgSlug: string;
  range: string;
  from?: string;
  to?: string;
  canExport: boolean;
}) {
  if (!canExport) return null;

  const params = new URLSearchParams();
  if (range) params.set("range", range);
  if (from) params.set("from", from);
  if (to) params.set("to", to);

  const href = `/api/orgs/${orgSlug}/reports/export?${params.toString()}`;

  return (
    <Button
      variant="outline"
      size="sm"
      className="h-9 gap-2"
      nativeButton={false}
      render={<a href={href} download />}
    >
      <Download className="size-4" aria-hidden="true" />
      <span>Exportar CSV</span>
    </Button>
  );
}
