import { addDays, differenceInCalendarDays, parseISO } from "date-fns";
import { computeEndDate, toISODate } from "@/lib/dates";

export { computeEndDate };

export type DerivedStatus =
  "al_dia" | "por_vencer" | "vencido" | "en_gracia" | "congelado" | "cancelado";

export const DERIVED_STATUS_LABELS: Record<DerivedStatus, string> = {
  al_dia: "Al día",
  por_vencer: "Por vencer",
  vencido: "Vencida",
  en_gracia: "En gracia",
  congelado: "Congelada",
  cancelado: "Cancelada",
};

export const EXPIRING_SOON_DAYS = 5;

type SubscriptionLike = {
  status: "active" | "expired" | "frozen" | "cancelled";
  startDate: string;
  endDate: string;
  frozenAt?: string | null;
  frozenUntil?: string | null;
};

function daysBetween(fromISO: string, toISO: string): number {
  return differenceInCalendarDays(parseISO(toISO), parseISO(fromISO));
}

// Estado derivado en tiempo real (independiente del cron de expiración).
export function deriveStatus(
  sub: SubscriptionLike,
  graceDays: number,
  todayISO: string,
): DerivedStatus {
  if (sub.status === "cancelled") return "cancelado";
  if (sub.status === "frozen") return "congelado";
  const daysLeft = daysBetween(todayISO, sub.endDate);
  if (daysLeft >= 0) {
    return daysLeft <= EXPIRING_SOON_DAYS ? "por_vencer" : "al_dia";
  }
  const daysExpired = -daysLeft;
  return daysExpired <= graceDays ? "en_gracia" : "vencido";
}

// Renovación: si la vigente aún no vence, la nueva empieza el día siguiente a su fin; si no, hoy.
export function renewalStartDate(currentEndISO: string | null, todayISO: string): string {
  if (!currentEndISO) return todayISO;
  if (daysBetween(todayISO, currentEndISO) >= 0) {
    return toISODate(addDays(parseISO(currentEndISO), 1));
  }
  return todayISO;
}

// Al descongelar, la fecha fin se extiende por los días que estuvo congelada.
export function extendedEndDateAfterFreeze(
  endISO: string,
  frozenAtISO: string,
  unfrozenAtISO: string,
): string {
  const frozenDays = Math.max(0, daysBetween(frozenAtISO, unfrozenAtISO));
  return toISODate(addDays(parseISO(endISO), frozenDays));
}

export function daysRemaining(endISO: string, todayISO: string): number {
  return daysBetween(todayISO, endISO);
}

export function canRenew(sub: SubscriptionLike): boolean {
  return sub.status !== "cancelled" && sub.status !== "frozen";
}

export function canFreeze(sub: SubscriptionLike, todayISO: string): boolean {
  return sub.status === "active" && daysBetween(todayISO, sub.endDate) >= 0;
}

export function canCancel(sub: SubscriptionLike): boolean {
  return sub.status === "active" || sub.status === "frozen";
}
