import { addDays, addMonths, differenceInCalendarDays, format, parseISO } from "date-fns";
import { TZDate } from "@date-fns/tz";
import { es } from "date-fns/locale";

export const DEFAULT_TZ = "America/Bogota";

// "Hoy" en la zona horaria del gimnasio, como fecha ISO (YYYY-MM-DD).
export function todayISO(tz = DEFAULT_TZ): string {
  return format(new TZDate(Date.now(), tz), "yyyy-MM-dd");
}

export function toISODate(d: Date): string {
  return format(d, "yyyy-MM-dd");
}

// Fecha fin de una membresía. Ej: mensual desde 2026-01-31 → 2026-02-28 (date-fns ajusta fin de mes).
export function computeEndDate(
  startISO: string,
  durationType: "days" | "months",
  durationValue: number,
): string {
  const start = parseISO(startISO);
  const end =
    durationType === "days" ? addDays(start, durationValue) : addMonths(start, durationValue);
  return toISODate(end);
}

export function daysUntil(dateISO: string, tz = DEFAULT_TZ): number {
  return differenceInCalendarDays(parseISO(dateISO), parseISO(todayISO(tz)));
}

export const dateFmt = new Intl.DateTimeFormat("es-CO", {
  dateStyle: "medium",
  timeZone: DEFAULT_TZ,
});
export const dateTimeFmt = new Intl.DateTimeFormat("es-CO", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: DEFAULT_TZ,
});

// date-fns + locale es: salida idéntica en Node y navegador (Intl "es-CO" difiere entre ICU
// de servidor y cliente → hydration mismatch). Ej: "28 feb 2026".
export function formatDate(iso: string | Date): string {
  return format(typeof iso === "string" ? parseISO(iso) : iso, "d MMM yyyy", { locale: es });
}
