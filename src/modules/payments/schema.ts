import { z } from "zod";
import { parsePesosInput } from "@/lib/money";
import { PAYMENT_METHODS, REFERENCE_REQUIRED_METHODS } from "./constants";

export const registerPaymentSchema = z
  .object({
    memberId: z.uuid("Selecciona un socio"),
    subscriptionId: z.uuid().nullable().optional(),
    amount: z
      .string()
      .trim()
      .min(1, "Ingresa el monto")
      .refine((v) => (parsePesosInput(v) ?? 0) > 0, "El monto debe ser mayor a cero"),
    method: z.enum(PAYMENT_METHODS),
    reference: z.string().trim().max(80, "Máximo 80 caracteres").optional().default(""),
    paidAt: z
      .string()
      .trim()
      .optional()
      .default("")
      .refine((v) => v === "" || !Number.isNaN(Date.parse(v)), "Fecha inválida"),
    notes: z.string().trim().max(500, "Máximo 500 caracteres").optional().default(""),
  })
  .superRefine((data, ctx) => {
    if (REFERENCE_REQUIRED_METHODS.includes(data.method) && !data.reference) {
      ctx.addIssue({
        code: "custom",
        path: ["reference"],
        message: "Ingresa la referencia o número de aprobación",
      });
    }
  });
export type RegisterPaymentInput = z.input<typeof registerPaymentSchema>;
export type RegisterPaymentData = z.output<typeof registerPaymentSchema>;

export const voidPaymentSchema = z.object({
  paymentId: z.uuid(),
  reason: z.string().trim().min(5, "Explica el motivo (mínimo 5 caracteres)").max(300),
});
export type VoidPaymentInput = z.infer<typeof voidPaymentSchema>;

export const paymentFiltersSchema = z.object({
  range: z.enum(["today", "week", "month", "custom", "all"]).default("today"),
  from: z.string().optional(),
  to: z.string().optional(),
  method: z.enum(PAYMENT_METHODS).optional(),
  status: z.enum(["completed", "voided"]).optional(),
  memberId: z.uuid().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(5).max(100).default(25),
});
export type PaymentFilters = z.infer<typeof paymentFiltersSchema>;
