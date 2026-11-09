import { TZDate } from "@date-fns/tz";
import {
  endOfDay,
  endOfMonth,
  endOfQuarter,
  format,
  parseISO,
  startOfDay,
  startOfMonth,
  startOfQuarter,
  startOfWeek,
  subMonths,
} from "date-fns";
import { z } from "zod";
import { DEFAULT_TZ } from "@/lib/dates";

export const REPORT_PRESETS = [
  "today",
  "week",
  "month",
  "last_month",
  "quarter",
  "custom",
] as const;

export type ReportPreset = (typeof REPORT_PRESETS)[number];

const isoDateRegex = /^\d{4}-\d{2}-\d{2}$/;

export const reportFiltersSchema = z
  .object({
    range: z.enum(REPORT_PRESETS).default("month"),
    from: z.string().regex(isoDateRegex, "Formato de fecha inválido (YYYY-MM-DD)").optional(),
    to: z.string().regex(isoDateRegex, "Formato de fecha inválido (YYYY-MM-DD)").optional(),
  })
  .superRefine((data, ctx) => {
    if (data.range === "custom") {
      if (data.from && data.to && data.from > data.to) {
        ctx.addIssue({
          code: "custom",
          path: ["from"],
          message: "La fecha inicial no puede ser posterior a la fecha final",
        });
      }
    }
  });

export type ReportFilters = z.infer<typeof reportFiltersSchema>;

export type ResolvedReportDateRange = {
  from: Date;
  to: Date;
  fromISO: string;
  toISO: string;
};

export function resolveReportDateRange(
  filters: Partial<ReportFilters>,
  tz = DEFAULT_TZ,
): ResolvedReportDateRange {
  const now = new TZDate(Date.now(), tz);
  let fromDate: Date;
  let toDate: Date;

  switch (filters.range) {
    case "today":
      fromDate = startOfDay(now);
      toDate = endOfDay(now);
      break;
    case "week":
      fromDate = startOfWeek(now, { weekStartsOn: 1 });
      toDate = endOfDay(now);
      break;
    case "last_month": {
      const prev = subMonths(now, 1);
      fromDate = startOfMonth(prev);
      toDate = endOfMonth(prev);
      break;
    }
    case "quarter":
      fromDate = startOfQuarter(now);
      toDate = endOfQuarter(now);
      break;
    case "custom": {
      fromDate = filters.from
        ? startOfDay(new TZDate(parseISO(filters.from), tz))
        : startOfMonth(now);
      toDate = filters.to ? endOfDay(new TZDate(parseISO(filters.to), tz)) : endOfMonth(now);
      break;
    }
    case "month":
    default:
      fromDate = startOfMonth(now);
      toDate = endOfMonth(now);
      break;
  }

  return {
    from: fromDate,
    to: toDate,
    fromISO: format(fromDate, "yyyy-MM-dd"),
    toISO: format(toDate, "yyyy-MM-dd"),
  };
}
