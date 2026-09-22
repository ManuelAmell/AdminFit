import { z } from "zod";
import { parsePesosInput } from "@/lib/money";

// Configuración general del gimnasio (org_settings). Por ahora solo el precio del pase
// del día (lo único que esta fase necesita); nit/dirección/teléfono/logo quedan para
// cuando se construya el resto de "Configuración" — no forman parte de esta fase.
export const generalSettingsSchema = z.object({
  dayPassPrice: z
    .string()
    .trim()
    .optional()
    .default("")
    .refine((v) => v === "" || (parsePesosInput(v) ?? 0) > 0, "El precio debe ser mayor a cero"),
});
export type GeneralSettingsInput = z.input<typeof generalSettingsSchema>;
