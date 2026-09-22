"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

const MONTH_NAMES = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];

function shiftMonth(monthISO: string, delta: number) {
  const [y, m] = monthISO.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function ReportsMonthPicker({ month }: { month: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const [y, m] = month.split("-").map(Number);
  const label = `${MONTH_NAMES[m - 1]} ${y}`;
  const isCurrentMonth = month === new Date().toISOString().slice(0, 7);

  function go(next: string) {
    router.push(`${pathname}?month=${next}`);
  }

  return (
    <div className="flex items-center gap-1">
      <Button
        variant="outline"
        size="icon-lg"
        aria-label="Mes anterior"
        onClick={() => go(shiftMonth(month, -1))}
      >
        <ChevronLeft />
      </Button>
      <span className="min-w-32 text-center text-sm font-medium capitalize">{label}</span>
      <Button
        variant="outline"
        size="icon-lg"
        aria-label="Mes siguiente"
        disabled={isCurrentMonth}
        onClick={() => go(shiftMonth(month, 1))}
      >
        <ChevronRight />
      </Button>
    </div>
  );
}
