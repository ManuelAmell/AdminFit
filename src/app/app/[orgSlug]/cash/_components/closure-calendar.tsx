"use client";

import Link from "next/link";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { formatDate } from "@/lib/dates";
import { formatCOP } from "@/lib/money";
import { CASH_DAY_STATUS_LABELS, type CashDay, type CashDayStatus } from "@/modules/cash/analytics";
import { cn } from "cn";

const WEEKDAYS = ["L", "M", "M", "J", "V", "S", "D"];

// Estados con color semántico del proyecto; los "sin cierre" van en neutro con borde para
// no depender solo del color (dataviz: redundancia de codificación).
const STATUS_CLASS: Record<CashDayStatus, string> = {
  balanced: "bg-success text-success-foreground",
  minor: "bg-warning text-warning-foreground",
  over: "bg-info text-info-foreground",
  short: "bg-destructive text-white",
  unclosed: "bg-background text-destructive border-2 border-dashed border-destructive/70",
  pending: "bg-primary/15 text-foreground ring-2 ring-primary ring-offset-1 ring-offset-card",
  idle: "bg-muted text-muted-foreground",
};

const LEGEND: CashDayStatus[] = ["balanced", "minor", "over", "short", "unclosed", "idle"];

// Lunes = 0 … domingo = 6.
function weekdayIndex(iso: string) {
  return (new Date(`${iso}T12:00:00Z`).getUTCDay() + 6) % 7;
}

export function ClosureCalendar({ days, closeHref }: { days: CashDay[]; closeHref: string }) {
  if (days.length === 0) return null;
  const offset = weekdayIndex(days[0].date);

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-7 gap-1.5" role="grid" aria-label="Calendario de cierres">
        {WEEKDAYS.map((w, i) => (
          <div
            key={i}
            role="columnheader"
            className="text-muted-foreground pb-1 text-center text-[11px] font-medium"
          >
            {w}
          </div>
        ))}
        {Array.from({ length: offset }).map((_, i) => (
          <div key={`pad-${i}`} aria-hidden="true" />
        ))}
        {days.map((d) => {
          const dayNum = Number(d.date.slice(8));
          const label = `${formatDate(d.date)}: ${CASH_DAY_STATUS_LABELS[d.status]}`;
          return (
            <Tooltip key={d.date}>
              <TooltipTrigger
                render={
                  <Link
                    href={`${closeHref}?date=${d.date}`}
                    aria-label={label}
                    className={cn(
                      "focus-visible:ring-ring flex h-9 items-center justify-center rounded-md text-xs font-medium tabular-nums transition-transform outline-none hover:scale-110 focus-visible:scale-110 focus-visible:ring-2",
                      STATUS_CLASS[d.status],
                    )}
                  />
                }
              >
                {dayNum}
              </TooltipTrigger>
              <TooltipContent className="flex-col items-start gap-0.5">
                <span className="font-semibold">{formatDate(d.date)}</span>
                <span>{CASH_DAY_STATUS_LABELS[d.status]}</span>
                {d.closures > 0 && (
                  <span className="tabular-nums">
                    Diferencia: {d.diffCents > 0 ? "+" : ""}
                    {formatCOP(d.diffCents)}
                  </span>
                )}
                {(d.cashInCents > 0 || d.cashOutCents > 0) && (
                  <span className="tabular-nums opacity-80">
                    Efectivo +{formatCOP(d.cashInCents)} / −{formatCOP(d.cashOutCents)}
                  </span>
                )}
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>
      <ul className="text-muted-foreground flex flex-wrap gap-x-4 gap-y-1.5 text-xs">
        {LEGEND.map((s) => (
          <li key={s} className="flex items-center gap-1.5">
            <span className={cn("size-3 rounded-sm", STATUS_CLASS[s])} aria-hidden="true" />
            {CASH_DAY_STATUS_LABELS[s]}
          </li>
        ))}
      </ul>
    </div>
  );
}
