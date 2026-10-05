import { z } from "zod";
import { parsePesosInput } from "@/lib/money";

// --- Planes SaaS ---

const priceField = z
  .string()
  .trim()
  .min(1, "Ingresa el precio")
  .transform((v, ctx) => {
    const cents = parsePesosInput(v);
    if (cents === null || cents <= 0) {
      ctx.addIssue({ code: "custom", message: "Ingresa un precio válido en pesos" });
      return z.NEVER;
    }
    return cents;
  });

export const platformPlanSchema = z.object({
  name: z.string().trim().min(2, "Mínimo 2 caracteres").max(60, "Máximo 60 caracteres"),
  description: z.string().trim().max(300).optional().or(z.literal("")),
  price: priceField,
  maxMembers: z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? null : Number(v)),
    z.number().int().min(1, "Mínimo 1").nullable(),
  ),
  maxBranches: z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? null : Number(v)),
    z.number().int().min(1, "Mínimo 1").nullable(),
  ),
  maxStaff: z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? null : Number(v)),
    z.number().int().min(1, "Mínimo 1").nullable(),
  ),
  isActive: z.boolean().default(true),
});
export type PlatformPlanInput = z.input<typeof platformPlanSchema>;

// --- Asignar / renovar suscripción ---

export const assignSubscriptionSchema = z.object({
  orgId: z.string().min(1, "Organización requerida"),
  planId: z.string().uuid("Plan inválido"),
  durationDays: z.coerce.number().int().min(1, "Mínimo 1 día").max(730, "Máximo 2 años"),
  status: z.enum(["trial", "active"]),
  notes: z.string().trim().max(500).optional().or(z.literal("")),
});
export type AssignSubscriptionInput = z.input<typeof assignSubscriptionSchema>;

// --- Datos bancarios ---

export const platformSettingsSchema = z.object({
  bankHolderName: z.string().trim().max(100).optional().or(z.literal("")),
  bankName: z.string().trim().max(60).optional().or(z.literal("")),
  bankAccountType: z.enum(["ahorros", "corriente"]).nullable().optional(),
  bankAccountNumber: z.string().trim().max(30).optional().or(z.literal("")),
  nequiNumber: z.string().trim().max(15).optional().or(z.literal("")),
  additionalInfo: z.string().trim().max(500).optional().or(z.literal("")),
});
export type PlatformSettingsInput = z.input<typeof platformSettingsSchema>;

// --- Labels ---

export const TENANT_SUB_STATUS_LABELS: Record<string, string> = {
  trial: "Trial",
  active: "Activo",
  expired: "Vencido",
};

export const BANK_ACCOUNT_TYPE_LABELS: Record<string, string> = {
  ahorros: "Ahorros",
  corriente: "Corriente",
};
