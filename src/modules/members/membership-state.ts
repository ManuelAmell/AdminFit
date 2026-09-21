import { daysUntil } from "@/lib/dates";
import type { MembershipState } from "./schema";

export const EXPIRING_THRESHOLD_DAYS = 5;

export type SubscriptionLike = {
  status: "active" | "expired" | "frozen" | "cancelled";
  endDate: string;
} | null;

// Estado derivado de la última suscripción del socio, usando los días de gracia de la org.
export function membershipState(sub: SubscriptionLike, graceDays: number): MembershipState {
  if (!sub || sub.status === "cancelled") return "none";
  if (sub.status === "frozen") return "frozen";
  const days = daysUntil(sub.endDate);
  if (days > EXPIRING_THRESHOLD_DAYS) return "current";
  if (days >= 0) return "expiring";
  if (-days <= graceDays) return "grace";
  return "expired";
}
