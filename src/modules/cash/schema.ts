import { z } from "zod";
import { parsePesosInput } from "@/lib/money";

const money = (label: string) =>
  z
    .string()
    .trim()
    .min(1, `Ingresa ${label}`)
    .refine((v) => parsePesosInput(v) !== null, `${label} inválido`)
    .refine((v) => (parsePesosInput(v) ?? -1) >= 0, `${label} no puede ser negativo`);

export const closeCashSchema = z.object({
  dateISO: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida"),
  branchId: z.uuid().nullable().optional(),
  openingCash: money("la base"),
  countedCash: money("el efectivo contado"),
  notes: z.string().trim().max(500, "Máximo 500 caracteres").optional().default(""),
});
export type CloseCashInput = z.input<typeof closeCashSchema>;

export const reopenCashSchema = z.object({ closureId: z.uuid() });
export type ReopenCashInput = z.infer<typeof reopenCashSchema>;
