import { z } from "zod";

export const trainerInputSchema = z.object({
  firstName: z.string().trim().min(1, "El nombre es obligatorio").max(100),
  lastName: z.string().trim().min(1, "El apellido es obligatorio").max(100),
  specialty: z.string().trim().max(100).optional().nullable(),
  phone: z.string().trim().max(30).optional().nullable(),
  email: z.string().trim().email("Email inválido").optional().nullable().or(z.literal("")),
  photoUrl: z.string().trim().optional().nullable(),
  bio: z.string().trim().max(500).optional().nullable(),
  isActive: z.boolean(),
});

export type TrainerInput = z.infer<typeof trainerInputSchema>;

export const classTypeInputSchema = z.object({
  name: z.string().trim().min(1, "El nombre de la modalidad es obligatorio").max(100),
  description: z.string().trim().max(500).optional().nullable(),
  color: z
    .string()
    .trim()
    .regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, "Color hexadecimal inválido (ej. #3b82f6)"),
  durationMinutes: z.number().int().min(5, "Mínimo 5 minutos").max(480, "Máximo 480 minutos"),
  defaultCapacity: z.number().int().min(1, "Mínimo 1 cupo").max(300, "Máximo 300 cupos"),
  isActive: z.boolean(),
});

export type ClassTypeInput = z.infer<typeof classTypeInputSchema>;

export const classSessionInputSchema = z
  .object({
    classTypeId: z.string().uuid("Modalidad de clase inválida"),
    trainerId: z.string().uuid("Entrenador inválido").optional().nullable().or(z.literal("")),
    branchId: z.string().uuid("Sede inválida").optional().nullable().or(z.literal("")),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida (YYYY-MM-DD)"),
    startTime: z.string().regex(/^\d{2}:\d{2}$/, "Hora de inicio inválida (HH:MM)"),
    endTime: z.string().regex(/^\d{2}:\d{2}$/, "Hora de fin inválida (HH:MM)"),
    capacity: z.number().int().min(1, "Mínimo 1 cupo").max(500, "Máximo 500 cupos"),
  })
  .refine((data) => data.startTime < data.endTime, {
    message: "La hora de finalización debe ser posterior a la de inicio",
    path: ["endTime"],
  });

export type ClassSessionInput = z.infer<typeof classSessionInputSchema>;

export const classBookingInputSchema = z.object({
  sessionId: z.string().uuid("Sesión de clase inválida"),
  memberId: z.string().uuid("Socio inválido"),
  notes: z.string().trim().max(200).optional().nullable(),
});

export type ClassBookingInput = z.infer<typeof classBookingInputSchema>;

export const updateBookingStatusSchema = z.object({
  bookingId: z.string().uuid("Reserva inválida"),
  status: z.enum(["confirmed", "attended", "no_show", "cancelled"]),
});

export type UpdateBookingStatusInput = z.infer<typeof updateBookingStatusSchema>;
