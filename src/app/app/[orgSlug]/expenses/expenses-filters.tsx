"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import { EXPENSE_CATEGORIES, EXPENSE_CATEGORY_LABELS } from "@/modules/expenses/constants";

const RANGES = [
  { value: "today", label: "Hoy" },
  { value: "week", label: "Esta semana" },
  { value: "month", label: "Este mes" },
  { value: "custom", label: "Rango" },
  { value: "all", label: "Todo" },
] as const;

const ALL = "__all__";
const categoryItems = [
  { value: ALL, label: "Todas las categorías" },
  ...EXPENSE_CATEGORIES.map((c) => ({ value: c, label: EXPENSE_CATEGORY_LABELS[c] })),
];
const statusItems = [
  { value: ALL, label: "Todos los estados" },
  { value: "completed", label: "Registrados" },
  { value: "voided", label: "Anulados" },
];

export function ExpensesFilters({
  range,
  from,
  to,
  category,
  status,
}: {
  range: string;
  from?: string;
  to?: string;
  category?: string;
  status?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();

  function update(patch: Record<string, string | undefined>) {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (!v || v === ALL) next.delete(k);
      else next.set(k, v);
    }
    next.delete("page");
    startTransition(() => router.replace(`${pathname}?${next.toString()}`));
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Periodo">
        {RANGES.map((r) => (
          <Button
            key={r.value}
            type="button"
            size="sm"
            variant={range === r.value ? "default" : "outline"}
            className={cn("h-9", range === r.value && "pointer-events-none")}
            aria-pressed={range === r.value}
            onClick={() => update({ range: r.value })}
          >
            {r.label}
          </Button>
        ))}
        {pending && <Spinner className="text-muted-foreground" />}
      </div>
      <div className="flex flex-wrap items-end gap-3">
        {range === "custom" && (
          <>
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
          </>
        )}
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="category">Categoría</Label>
          <Select
            items={categoryItems}
            value={category ?? ALL}
            onValueChange={(v) => update({ category: v ?? undefined })}
          >
            <SelectTrigger id="category" className="h-9 w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {categoryItems.map((c) => (
                <SelectItem key={c.value} value={c.value}>
                  {c.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="status">Estado</Label>
          <Select
            items={statusItems}
            value={status ?? ALL}
            onValueChange={(v) => update({ status: v ?? undefined })}
          >
            <SelectTrigger id="status" className="h-9 w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {statusItems.map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}
