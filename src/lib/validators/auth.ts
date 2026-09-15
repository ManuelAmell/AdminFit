import { z } from "zod";

export const emailSchema = z.email("Ingresa un correo válido");
export const passwordSchema = z
  .string()
  .min(8, "Mínimo 8 caracteres")
  .max(128, "Máximo 128 caracteres");

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Ingresa tu contraseña"),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const accountStepSchema = z.object({
  name: z.string().trim().min(2, "Ingresa tu nombre").max(80),
  email: emailSchema,
  password: passwordSchema,
});
export type AccountStepInput = z.infer<typeof accountStepSchema>;

export const slugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, "Mínimo 3 caracteres")
  .max(40, "Máximo 40 caracteres")
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Solo letras minúsculas, números y guiones");

export const gymStepSchema = z.object({
  gymName: z.string().trim().min(2, "Ingresa el nombre del gimnasio").max(80),
  slug: slugSchema,
  city: z.string().trim().min(2, "Ingresa la ciudad").max(80),
});
export type GymStepInput = z.infer<typeof gymStepSchema>;

export function slugify(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}
