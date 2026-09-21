"use client";

import { usePathname, useRouter } from "next/navigation";
import { useTransition } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";

export function CashCloseDatePicker({ value }: { value: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();
  return (
    <div className="flex items-center gap-2">
      <Label htmlFor="cash-date" className="sr-only">
        Fecha del cierre
      </Label>
      <Input
        id="cash-date"
        type="date"
        className="h-9 w-40"
        defaultValue={value}
        onChange={(e) => {
          if (!e.target.value) return;
          startTransition(() => router.replace(`${pathname}?date=${e.target.value}`));
        }}
      />
      {pending && <Spinner className="text-muted-foreground" />}
    </div>
  );
}
