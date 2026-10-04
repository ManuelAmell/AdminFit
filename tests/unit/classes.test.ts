import { describe, expect, it } from "vitest";
import {
  classBookingInputSchema,
  classSessionInputSchema,
  classTypeInputSchema,
  trainerInputSchema,
  updateBookingStatusSchema,
} from "@/modules/classes/schema";

describe("Classes Module - Schema & Validation", () => {
  describe("trainerInputSchema", () => {
    it("valida un entrenador con datos válidos mínimos", () => {
      const valid = {
        firstName: "Carlos",
        lastName: "Montero",
        isActive: true,
      };
      const res = trainerInputSchema.safeParse(valid);
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data.isActive).toBe(true);
      }
    });

    it("falla si no tiene nombre o apellido", () => {
      const invalid = {
        firstName: "",
        lastName: "   ",
        isActive: true,
      };
      const res = trainerInputSchema.safeParse(invalid);
      expect(res.success).toBe(false);
    });

    it("valida email opcional o vacío correctamente", () => {
      const withEmptyEmail = {
        firstName: "Laura",
        lastName: "Gómez",
        email: "",
        isActive: true,
      };
      expect(trainerInputSchema.safeParse(withEmptyEmail).success).toBe(true);

      const withInvalidEmail = {
        firstName: "Laura",
        lastName: "Gómez",
        email: "not-an-email",
        isActive: true,
      };
      expect(trainerInputSchema.safeParse(withInvalidEmail).success).toBe(false);
    });
  });

  describe("classTypeInputSchema", () => {
    it("valida una modalidad de clase correcta", () => {
      const valid = {
        name: "Spinning Pro",
        color: "#ef4444",
        durationMinutes: 45,
        defaultCapacity: 25,
        isActive: true,
      };
      const res = classTypeInputSchema.safeParse(valid);
      expect(res.success).toBe(true);
    });

    it("rechaza color hexadecimal inválido", () => {
      const invalid = {
        name: "Yoga",
        color: "red",
        durationMinutes: 60,
        defaultCapacity: 15,
        isActive: true,
      };
      const res = classTypeInputSchema.safeParse(invalid);
      expect(res.success).toBe(false);
    });

    it("rechaza capacidad o duración menores a 1", () => {
      const invalid = {
        name: "CrossFit",
        color: "#3b82f6",
        durationMinutes: 0,
        defaultCapacity: -5,
        isActive: true,
      };
      const res = classTypeInputSchema.safeParse(invalid);
      expect(res.success).toBe(false);
    });
  });

  describe("classSessionInputSchema", () => {
    const validSession = {
      classTypeId: "b7e28b80-1a7f-4a0b-99f2-085e94d8cb8e",
      date: "2026-04-10",
      startTime: "07:00",
      endTime: "08:00",
      capacity: 20,
    };

    it("acepta horario coherente donde inicio < fin", () => {
      const res = classSessionInputSchema.safeParse(validSession);
      expect(res.success).toBe(true);
    });

    it("rechaza sesión donde hora de fin es anterior o igual a la de inicio", () => {
      const invalid = {
        ...validSession,
        startTime: "09:00",
        endTime: "08:30",
      };
      const res = classSessionInputSchema.safeParse(invalid);
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error.issues[0]?.message).toContain(
          "La hora de finalización debe ser posterior a la de inicio",
        );
      }
    });

    it("rechaza fecha con formato inválido", () => {
      const invalid = {
        ...validSession,
        date: "10/04/2026",
      };
      const res = classSessionInputSchema.safeParse(invalid);
      expect(res.success).toBe(false);
    });
  });

  describe("classBookingInputSchema", () => {
    it("valida reserva con UUIDs correctos", () => {
      const valid = {
        sessionId: "a1a1a1a1-b2b2-4c3c-8d4d-e5e5e5e5e5e5",
        memberId: "f1f1f1f1-b2b2-4c3c-8d4d-e5e5e5e5e5e5",
        notes: "Llega 5 min tarde",
      };
      const res = classBookingInputSchema.safeParse(valid);
      expect(res.success).toBe(true);
    });

    it("rechaza reserva con UUIDs no válidos", () => {
      const invalid = {
        sessionId: "not-a-uuid",
        memberId: "not-a-uuid",
      };
      const res = classBookingInputSchema.safeParse(invalid);
      expect(res.success).toBe(false);
    });
  });

  describe("updateBookingStatusSchema", () => {
    it("acepta estados permitidos", () => {
      const statuses = ["confirmed", "attended", "no_show", "cancelled"] as const;
      for (const status of statuses) {
        const res = updateBookingStatusSchema.safeParse({
          bookingId: "a1a1a1a1-b2b2-4c3c-8d4d-e5e5e5e5e5e5",
          status,
        });
        expect(res.success).toBe(true);
      }
    });

    it("rechaza estado desconocido", () => {
      const res = updateBookingStatusSchema.safeParse({
        bookingId: "a1a1a1a1-b2b2-4c3c-8d4d-e5e5e5e5e5e5",
        status: "pending",
      });
      expect(res.success).toBe(false);
    });
  });
});
