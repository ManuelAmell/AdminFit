import { z } from "zod";
import { parsePesosInput } from "@/lib/money";

export const PLAN_COLORS = ["orange", "blue", "green", "violet", "pink", "amber", "slate"] as const;
export type PlanColor = (typeof PLAN_COLORS)[number];

export const PLAN_COLOR_CLASSES: Record<PlanColor, string> = {
  orange: "bg-orange-500/15 text-orange-700 dark:text-orange-300",
  blue: "bg-blue-500/15 text-blue-700 dark:text-blue-300",
  green: "bg-green-500/15 text-green-700 dark:text-green-300",
  violet: "bg-violet-500/15 text-violet-700 dark:text-violet-300",
  pink: "bg-pink-500/15 text-pink-700 dark:text-pink-300",
  amber: "bg-amber-500/15 text-amber-800 dark:text-amber-300",
  slate: "bg-slate-500/15 text-slate-700 dark:text-slate-300",
};

// Punto de color sólido (el mapa anterior es para fondos de badge).
export const PLAN_COLOR_DOT: Record<PlanColor, string> = {
  orange: "bg-orange-500",
  blue: "bg-blue-500",
  green: "bg-green-500",
  violet: "bg-violet-500",
  pink: "bg-pink-500",
  amber: "bg-amber-500",
  slate: "bg-slate-500",
};

export const PLAN_COLOR_LABELS: Record<PlanColor, string> = {
  orange: "Naranja",
  blue: "Azul",
  green: "Verde",
  violet: "Violeta",
  pink: "Rosa",
  amber: "Ámbar",
  slate: "Gris",
};

// Precio en pesos como texto ("120.000") → centavos.
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
    if (cents > 100_000_000_00) {
      ctx.addIssue({ code: "custom", message: "El precio es demasiado alto" });
      return z.NEVER;
    }
    return cents;
  });

export const planInputSchema = z.object({
  name: z.string().trim().min(2, "Ingresa el nombre del plan").max(60, "Máximo 60 caracteres"),
  description: z.string().trim().max(300, "Máximo 300 caracteres").optional().or(z.literal("")),
  price: priceField,
  durationType: z.enum(["days", "months"]),
  durationValue: z.coerce
    .number({ message: "Ingresa un número" })
    .int("Debe ser un número entero")
    .min(1, "Mínimo 1")
    .max(365, "Máximo 365"),
  visitLimit: z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? null : Number(v)),
    z
      .number({ message: "Ingresa un número" })
      .int("Debe ser un número entero")
      .min(1, "Mínimo 1")
      .nullable(),
  ),
  color: z.enum(PLAN_COLORS),
  isActive: z.boolean().default(true),
});

export type PlanInput = z.input<typeof planInputSchema>;
export type PlanParsed = z.output<typeof planInputSchema>;

export const planIdSchema = z.object({ planId: z.uuid() });

export function durationLabel(durationType: "days" | "months", durationValue: number): string {
  if (durationType === "days") return durationValue === 1 ? "1 día" : `${durationValue} días`;
  if (durationValue === 1) return "1 mes";
  if (durationValue === 12) return "1 año";
  return `${durationValue} meses`;
}
