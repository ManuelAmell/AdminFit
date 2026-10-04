import { z } from "zod";

export const branchInputSchema = z.object({
  name: z.string().trim().min(2, "Ingresa el nombre de la sede").max(100, "Máximo 100 caracteres"),
  address: z
    .string()
    .trim()
    .max(200, "Máximo 200 caracteres")
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .optional(),
  phone: z
    .string()
    .trim()
    .max(50, "Máximo 50 caracteres")
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .optional(),
});

export type BranchInput = z.input<typeof branchInputSchema>;
export type BranchValues = z.output<typeof branchInputSchema>;
