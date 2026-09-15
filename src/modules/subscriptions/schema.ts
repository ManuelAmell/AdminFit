import { z } from "zod";

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida")
  .refine((v) => !Number.isNaN(Date.parse(v)), "Fecha inválida");

export const sellSubscriptionSchema = z.object({
  memberId: z.uuid("Selecciona un socio"),
  planId: z.uuid("Selecciona un plan"),
  startDate: isoDate.optional().or(z.literal("")),
  notes: z.string().trim().max(300, "Máximo 300 caracteres").optional().or(z.literal("")),
});
export type SellSubscriptionInput = z.input<typeof sellSubscriptionSchema>;

export const renewSubscriptionSchema = z.object({
  subscriptionId: z.uuid(),
  planId: z.uuid("Selecciona un plan").optional(),
  notes: z.string().trim().max(300).optional().or(z.literal("")),
});

export const freezeSubscriptionSchema = z.object({
  subscriptionId: z.uuid(),
  frozenUntil: isoDate.optional().or(z.literal("")),
});

export const unfreezeSubscriptionSchema = z.object({ subscriptionId: z.uuid() });

export const cancelSubscriptionSchema = z.object({
  subscriptionId: z.uuid(),
  reason: z.string().trim().min(3, "Cuéntanos el motivo").max(300, "Máximo 300 caracteres"),
});

export const SUBSCRIPTION_FILTERS = [
  "all",
  "active",
  "expiring",
  "expired",
  "frozen",
  "cancelled",
] as const;
export type SubscriptionFilter = (typeof SUBSCRIPTION_FILTERS)[number];

export const listSubscriptionsSchema = z.object({
  filter: z.enum(SUBSCRIPTION_FILTERS).default("all"),
  planId: z.uuid().optional(),
  q: z.string().trim().max(80).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(5).max(100).default(20),
});
export type ListSubscriptionsInput = z.input<typeof listSubscriptionsSchema>;
