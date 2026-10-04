import type { Member, Plan, Subscription } from "@/db/schema";
import { formatDate } from "@/lib/dates";
import { deriveStatus } from "@/modules/subscriptions/rules";
import type { CheckinStatus } from "./schema";

export type EvaluationResult = {
  status: CheckinStatus;
  reason: string;
  shouldIncrementVisits: boolean;
  member: Member;
  subscription: (Subscription & { plan?: Plan | null }) | null;
};

export function evaluateCheckin(
  member: Member,
  latestSub: (Subscription & { plan?: Plan | null }) | null,
  graceDays: number,
  todayISO: string,
): EvaluationResult {
  if (member.status === "suspended") {
    return {
      status: "rejected",
      reason: "Socio suspendido administrativamente.",
      shouldIncrementVisits: false,
      member,
      subscription: latestSub,
    };
  }

  if (member.status === "inactive") {
    return {
      status: "rejected",
      reason: "Socio inactivo.",
      shouldIncrementVisits: false,
      member,
      subscription: latestSub,
    };
  }

  if (!latestSub) {
    return {
      status: "rejected",
      reason: "El socio no tiene ninguna membresía registrada.",
      shouldIncrementVisits: false,
      member,
      subscription: null,
    };
  }

  if (latestSub.status === "cancelled") {
    return {
      status: "rejected",
      reason: "La membresía se encuentra cancelada.",
      shouldIncrementVisits: false,
      member,
      subscription: latestSub,
    };
  }

  if (latestSub.status === "frozen") {
    const until = latestSub.frozenUntil ? ` hasta ${formatDate(latestSub.frozenUntil)}` : "";
    return {
      status: "rejected",
      reason: `Membresía congelada${until}.`,
      shouldIncrementVisits: false,
      member,
      subscription: latestSub,
    };
  }

  if (
    latestSub.visitLimitSnapshot !== null &&
    latestSub.visitLimitSnapshot !== undefined &&
    latestSub.visitsUsed >= latestSub.visitLimitSnapshot
  ) {
    return {
      status: "rejected",
      reason: `Límite de visitas alcanzado (${latestSub.visitsUsed}/${latestSub.visitLimitSnapshot}).`,
      shouldIncrementVisits: false,
      member,
      subscription: latestSub,
    };
  }

  const derived = deriveStatus(latestSub, graceDays, todayISO);

  if (derived === "vencido") {
    return {
      status: "rejected",
      reason: `Membresía vencida el ${formatDate(latestSub.endDate)}. Período de gracia agotado.`,
      shouldIncrementVisits: false,
      member,
      subscription: latestSub,
    };
  }

  const planName = latestSub.plan?.name ? ` [${latestSub.plan.name}]` : "";
  const isVisitPlan = latestSub.visitLimitSnapshot !== null;
  const visitInfo = isVisitPlan
    ? ` (Visita ${latestSub.visitsUsed + 1}/${latestSub.visitLimitSnapshot})`
    : "";

  if (derived === "en_gracia") {
    return {
      status: "granted",
      reason: `Acceso en período de gracia${planName}. Venció el ${formatDate(latestSub.endDate)}. Pendiente de renovación.`,
      shouldIncrementVisits: isVisitPlan,
      member,
      subscription: latestSub,
    };
  }

  if (derived === "por_vencer") {
    return {
      status: "granted",
      reason: `Acceso concedido${planName}${visitInfo}. Membresía por vencer el ${formatDate(latestSub.endDate)}.`,
      shouldIncrementVisits: isVisitPlan,
      member,
      subscription: latestSub,
    };
  }

  return {
    status: "granted",
    reason: `Acceso concedido${planName}${visitInfo}. Membresía al día (vence el ${formatDate(latestSub.endDate)}).`,
    shouldIncrementVisits: isVisitPlan,
    member,
    subscription: latestSub,
  };
}
