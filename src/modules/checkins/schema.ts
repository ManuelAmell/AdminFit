import { z } from "zod";

export const checkinStatusSchema = z.enum(["granted", "rejected"]);
export type CheckinStatus = z.infer<typeof checkinStatusSchema>;

export const checkinInputSchema = z.object({
  identifier: z.string().trim().min(1, "Ingresa el documento o escanea el código QR").max(100),
  branchId: z.string().uuid().nullable().optional(),
});

export type CheckinInput = z.infer<typeof checkinInputSchema>;
