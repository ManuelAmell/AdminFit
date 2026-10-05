"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";

// Solo se renderiza cuando la org tiene más de una sede (el cierre es por sede/día —
// drizzle/0005 — así que hace falta elegir cuál se está cerrando).
export function CashCloseBranchPicker({
  branches,
  value,
}: {
  branches: { id: string; name: string }[];
  value: string | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();

  function update(branchId: string) {
    const next = new URLSearchParams(params.toString());
    next.set("branchId", branchId);
    startTransition(() => router.replace(`${pathname}?${next.toString()}`));
  }

  const items = branches.map((b) => ({ value: b.id, label: b.name }));

  return (
    <div className="flex items-center gap-2">
      <Select items={items} value={value ?? branches[0]?.id} onValueChange={(v) => v && update(v)}>
        <SelectTrigger className="h-9 w-40">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {branches.map((b) => (
            <SelectItem key={b.id} value={b.id}>
              {b.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {pending && <Spinner className="text-muted-foreground" />}
    </div>
  );
}
