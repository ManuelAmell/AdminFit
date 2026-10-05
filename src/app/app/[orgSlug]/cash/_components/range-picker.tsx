import Link from "next/link";
import { CASH_RANGE_LABELS, CASH_RANGES, type CashRange } from "@/modules/cash/analytics";
import { cn } from "cn";

// Control segmentado con links (sin JS): el rango vive en la URL (?range=).
export function CashRangePicker({
  value,
  hrefFor,
}: {
  value: CashRange;
  hrefFor: (range: CashRange) => string;
}) {
  return (
    <nav aria-label="Periodo" className="bg-muted flex rounded-lg p-0.5">
      {CASH_RANGES.map((r) => (
        <Link
          key={r}
          href={hrefFor(r)}
          aria-current={r === value ? "page" : undefined}
          className={cn(
            "rounded-md px-2.5 py-1.5 text-xs font-medium whitespace-nowrap transition-colors",
            r === value
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {CASH_RANGE_LABELS[r]}
        </Link>
      ))}
    </nav>
  );
}
