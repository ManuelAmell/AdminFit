"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import type { ReportPreset } from "@/modules/reports/schema";

const PRESET_LABELS: Array<{ value: ReportPreset; label: string }> = [
  { value: "today", label: "Hoy" },
  { value: "week", label: "Esta semana" },
  { value: "month", label: "Este mes" },
  { value: "last_month", label: "Mes anterior" },
  { value: "quarter", label: "Trimestre" },
  { value: "custom", label: "Personalizado" },
];

export function ReportsFilters({ range, from, to }: { range: string; from?: string; to?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();

  function update(patch: Record<string, string | undefined>) {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (!v) next.delete(k);
      else next.set(k, v);
    }
    startTransition(() => router.replace(`${pathname}?${next.toString()}`));
  }

  return (
    <div className="flex flex-col gap-3">
      <div
        className="flex flex-wrap items-center gap-2"
        role="group"
        aria-label="Periodo del reporte"
      >
        {PRESET_LABELS.map((p) => {
          const isSelected = range === p.value;
          return (
            <Button
              key={p.value}
              type="button"
              size="sm"
              variant={isSelected ? "default" : "outline"}
              className={cn("h-9", isSelected && "pointer-events-none")}
              aria-pressed={isSelected}
              onClick={() => update({ range: p.value })}
            >
              {p.label}
            </Button>
          );
        })}
        {pending && <Spinner className="text-muted-foreground ml-2 size-4" />}
      </div>

      {range === "custom" && (
        <div className="flex flex-wrap items-end gap-3 pt-1">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="from">Desde</Label>
            <Input
              id="from"
              type="date"
              className="h-9 w-40"
              defaultValue={from ?? ""}
              onChange={(e) => update({ from: e.target.value })}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="to">Hasta</Label>
            <Input
              id="to"
              type="date"
              className="h-9 w-40"
              defaultValue={to ?? ""}
              onChange={(e) => update({ to: e.target.value })}
            />
          </div>
        </div>
      )}
    </div>
  );
}
