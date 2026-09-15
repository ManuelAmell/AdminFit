import { z } from "zod";

export const DOCUMENT_TYPES = ["CC", "TI", "CE", "PAS", "NIT"] as const;
export const MEMBER_STATUSES = ["active", "inactive", "suspended"] as const;
export const GENDERS = ["female", "male", "other", "unspecified"] as const;

export type DocumentType = (typeof DOCUMENT_TYPES)[number];
export type MemberStatus = (typeof MEMBER_STATUSES)[number];
export type Gender = (typeof GENDERS)[number];

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .optional();

const phoneSchema = z
  .string()
  .trim()
  .regex(/^[\d\s()+-]{7,20}$/, "Teléfono inválido (solo dígitos, espacios, +, -)")
  .transform((v) => (v === "" ? null : v))
  .nullable()
  .optional()
  .or(z.literal("").transform(() => null));

export const memberInputSchema = z.object({
  documentType: z.enum(DOCUMENT_TYPES, { message: "Tipo de documento inválido" }),
  documentNumber: z
    .string()
    .trim()
    .min(4, "Mínimo 4 caracteres")
    .max(20, "Máximo 20 caracteres")
    .regex(/^[A-Za-z0-9-]+$/, "Solo letras, números y guiones"),
  firstName: z.string().trim().min(2, "Ingresa el nombre").max(80),
  lastName: z.string().trim().min(2, "Ingresa el apellido").max(80),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .optional()
    .refine((v) => v == null || z.email().safeParse(v).success, "Correo inválido"),
  phone: phoneSchema,
  birthDate: z
    .string()
    .trim()
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .optional()
    .refine((v) => v == null || /^\d{4}-\d{2}-\d{2}$/.test(v), "Fecha inválida (AAAA-MM-DD)"),
  gender: z.enum(GENDERS).default("unspecified"),
  emergencyContactName: optionalText(80),
  emergencyContactPhone: phoneSchema,
  notes: optionalText(1000),
  branchId: z.uuid().nullable().optional(),
});

export type MemberInput = z.input<typeof memberInputSchema>;
export type MemberValues = z.output<typeof memberInputSchema>;

export const memberStatusSchema = z.enum(MEMBER_STATUSES);

export const listMembersParamsSchema = z.object({
  q: z.string().trim().max(80).optional().default(""),
  status: z
    .enum([...MEMBER_STATUSES, "all"])
    .optional()
    .default("all"),
  sort: z.enum(["name", "document", "createdAt"]).optional().default("name"),
  dir: z.enum(["asc", "desc"]).optional().default("asc"),
  page: z.coerce.number().int().min(1).optional().default(1),
  pageSize: z.coerce.number().int().min(5).max(100).optional().default(20),
});
export type ListMembersParams = z.output<typeof listMembersParamsSchema>;

// Estado derivado de la membresía vigente (badge en lista y ficha).
export const MEMBERSHIP_STATES = [
  "current",
  "expiring",
  "grace",
  "expired",
  "frozen",
  "none",
] as const;
export type MembershipState = (typeof MEMBERSHIP_STATES)[number];
