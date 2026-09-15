import type { DocumentType, Gender, MemberStatus, MembershipState } from "@/modules/members/schema";

export const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  CC: "Cédula de ciudadanía",
  TI: "Tarjeta de identidad",
  CE: "Cédula de extranjería",
  PAS: "Pasaporte",
  NIT: "NIT",
};

export const MEMBER_STATUS_LABELS: Record<MemberStatus, string> = {
  active: "Activo",
  inactive: "Inactivo",
  suspended: "Suspendido",
};

export const GENDER_LABELS: Record<Gender, string> = {
  female: "Femenino",
  male: "Masculino",
  other: "Otro",
  unspecified: "No especifica",
};

export const MEMBERSHIP_STATE_LABELS: Record<MembershipState, string> = {
  current: "Al día",
  expiring: "Por vencer",
  grace: "En gracia",
  expired: "Vencido",
  frozen: "Congelado",
  none: "Sin membresía",
};
