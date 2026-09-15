"use client";

import { Search } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { SubscriptionFilter } from "@/modules/subscriptions/schema";

const CHIPS: { value: SubscriptionFilter; label: string; countKey?: keyof Counts }[] = [
  { value: "all", label: "Todas" },
  { value: "active", label: "Activas", countKey: "active" },
  { value: "expiring", label: "Por vencer", countKey: "expiring" },
  { value: "expired", label: "Vencidas", countKey: "expired" },
  { value: "frozen", label: "Congeladas", countKey: "frozen" },
  { value: "cancelled", label: "Canceladas", countKey: "cancelled" },
];

type Counts = Record<"active" | "expiring" | "expired" | "frozen" | "cancelled", number>;

function buildHref(
  orgSlug: string,
  params: { filter?: string; plan?: string; q?: string },
): string {
  const sp = new URLSearchParams();
  if (params.filter && params.filter !== "all") sp.set("filter", params.filter);
  if (params.plan) sp.set("plan", params.plan);
  if (params.q) sp.set("q", params.q);
  const qs = sp.toString();
  return `/app/${orgSlug}/memberships${qs ? `?${qs}` : ""}`;
}

export function MembershipsFilters({
  orgSlug,
  filter,
  planId,
  q,
  counts,
  plans,
}: {
  orgSlug: string;
  filter: SubscriptionFilter;
  planId?: string;
  q?: string;
  counts: Counts;
  plans: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [search, setSearch] = useState(q ?? "");
  const planItems = [
    { value: "", label: "Todos los planes" },
    ...plans.map((p) => ({ value: p.id, label: p.name })),
  ];

  return (
    <div className="flex flex-col gap-3">
      <nav aria-label="Filtrar por estado" className="-mx-1 overflow-x-auto px-1">
        <ul className="flex gap-2">
          {CHIPS.map((chip) => {
            const active = chip.value === filter;
            const n = chip.countKey ? counts[chip.countKey] : undefined;
            return (
              <li key={chip.value}>
                <Link
                  href={buildHref(orgSlug, { filter: chip.value, plan: planId, q })}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "focus-visible:ring-ring/50 inline-flex h-9 items-center gap-1.5 rounded-full border px-3 text-sm whitespace-nowrap transition-colors outline-none focus-visible:ring-3",
                    active
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-background text-foreground hover:bg-muted",
                  )}
                >
                  {chip.label}
                  {n !== undefined && (
                    <span
                      className={cn(
                        "rounded-full px-1.5 text-xs tabular-nums",
                        active ? "bg-primary-foreground/20" : "bg-muted text-muted-foreground",
                      )}
                    >
                      {n}
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      <form
        className="flex flex-col gap-2 sm:flex-row"
        onSubmit={(e) => {
          e.preventDefault();
          router.push(buildHref(orgSlug, { filter, plan: planId, q: search.trim() || undefined }));
        }}
      >
        <div className="relative flex-1">
          <Search
            className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
            aria-hidden="true"
          />
          <Input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar socio por nombre o documento"
            aria-label="Buscar socio"
            className="h-10 pl-9"
          />
        </div>
        <Select
          items={planItems}
          value={planId ?? ""}
          onValueChange={(v) =>
            router.push(
              buildHref(orgSlug, { filter, plan: v || undefined, q: search.trim() || undefined }),
            )
          }
        >
          <SelectTrigger className="h-10 w-full sm:w-56" aria-label="Filtrar por plan">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {planItems.map((p) => (
              <SelectItem key={p.value || "all"} value={p.value}>
                {p.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </form>
    </div>
  );
}
