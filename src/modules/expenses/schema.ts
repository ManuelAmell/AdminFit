import { z } from "zod";
import { parsePesosInput } from "@/lib/money";
import { PAYMENT_METHODS } from "@/modules/payments/constants";
import { EXPENSE_CATEGORIES } from "./constants";

export const createExpenseSchema = z.object({
  category: z.enum(EXPENSE_CATEGORIES),
  description: z.string().trim().min(1, "Describe el gasto").max(200, "Máximo 200 caracteres"),
  branchId: z.uuid().nullable().optional(),
  amount: z
    .string()
    .trim()
    .min(1, "Ingresa el monto")
    .refine((v) => (parsePesosInput(v) ?? 0) > 0, "El monto debe ser mayor a cero"),
  method: z.enum(PAYMENT_METHODS),
  spentAt: z
    .string()
    .trim()
    .optional()
    .default("")
    .refine((v) => v === "" || !Number.isNaN(Date.parse(v)), "Fecha inválida"),
  notes: z.string().trim().max(500, "Máximo 500 caracteres").optional().default(""),
});
export type CreateExpenseInput = z.input<typeof createExpenseSchema>;
export type CreateExpenseData = z.output<typeof createExpenseSchema>;

export const voidExpenseSchema = z.object({
  expenseId: z.uuid(),
  reason: z.string().trim().min(5, "Explica el motivo (mínimo 5 caracteres)").max(300),
});
export type VoidExpenseInput = z.infer<typeof voidExpenseSchema>;

export const expenseFiltersSchema = z.object({
  range: z.enum(["today", "week", "month", "custom", "all"]).default("month"),
  from: z.string().optional(),
  to: z.string().optional(),
  category: z.enum(EXPENSE_CATEGORIES).optional(),
  status: z.enum(["completed", "voided"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(5).max(100).default(25),
});
export type ExpenseFilters = z.infer<typeof expenseFiltersSchema>;
