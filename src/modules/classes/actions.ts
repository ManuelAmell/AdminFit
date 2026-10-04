"use server";

import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { classBookings, classSessions, classTypes, members, trainers } from "@/db/schema";
import { ForbiddenError, requirePermission } from "@/lib/auth/authorize";
import { withTenant } from "@/lib/tenant";
import { audit } from "@/modules/audit";
import {
  classBookingInputSchema,
  classSessionInputSchema,
  classTypeInputSchema,
  trainerInputSchema,
  updateBookingStatusSchema,
  type ClassBookingInput,
  type ClassSessionInput,
  type ClassTypeInput,
  type TrainerInput,
  type UpdateBookingStatusInput,
} from "./schema";

export type ActionResult<T = undefined> =
  { ok: true; data: T } | { ok: false; error: string; fieldErrors?: Record<string, string> };

function fail(err: unknown, defaultMessage: string): ActionResult<never> {
  if (err instanceof ForbiddenError) return { ok: false, error: err.message };
  console.error(err);
  return { ok: false, error: defaultMessage };
}

// ---------------- TRAINERS ----------------

export async function createTrainer(
  orgSlug: string,
  input: TrainerInput,
): Promise<ActionResult<{ id: string }>> {
  try {
    const { org, userId } = await requirePermission(orgSlug, { gymClass: ["create"] });
    const parsed = trainerInputSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: "Datos del entrenador inválidos." };
    }

    const trainer = await withTenant(org.id, async (tx) => {
      const [inserted] = await tx
        .insert(trainers)
        .values({
          orgId: org.id,
          firstName: parsed.data.firstName,
          lastName: parsed.data.lastName,
          specialty: parsed.data.specialty ?? null,
          phone: parsed.data.phone ?? null,
          email: parsed.data.email || null,
          photoUrl: parsed.data.photoUrl ?? null,
          bio: parsed.data.bio ?? null,
          isActive: parsed.data.isActive,
        })
        .returning();

      await audit(tx, {
        orgId: org.id,
        actorId: userId,
        entity: "trainer",
        entityId: inserted.id,
        action: "trainer.create",
        diff: { after: inserted },
      });

      return inserted;
    });

    revalidatePath(`/app/${orgSlug}/classes/trainers`);
    return { ok: true, data: { id: trainer.id } };
  } catch (err) {
    return fail(err, "No se pudo crear el entrenador.");
  }
}

export async function updateTrainer(
  orgSlug: string,
  id: string,
  input: TrainerInput,
): Promise<ActionResult> {
  try {
    const { org, userId } = await requirePermission(orgSlug, { gymClass: ["update"] });
    const parsed = trainerInputSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: "Datos del entrenador inválidos." };
    }

    await withTenant(org.id, async (tx) => {
      const [existing] = await tx
        .select()
        .from(trainers)
        .where(and(eq(trainers.id, id), eq(trainers.orgId, org.id), isNull(trainers.deletedAt)));

      if (!existing) {
        throw new Error("Entrenador no encontrado");
      }

      const [updated] = await tx
        .update(trainers)
        .set({
          firstName: parsed.data.firstName,
          lastName: parsed.data.lastName,
          specialty: parsed.data.specialty ?? null,
          phone: parsed.data.phone ?? null,
          email: parsed.data.email || null,
          photoUrl: parsed.data.photoUrl ?? null,
          bio: parsed.data.bio ?? null,
          isActive: parsed.data.isActive,
        })
        .where(eq(trainers.id, id))
        .returning();

      await audit(tx, {
        orgId: org.id,
        actorId: userId,
        entity: "trainer",
        entityId: id,
        action: "trainer.update",
        diff: { before: existing, after: updated },
      });
    });

    revalidatePath(`/app/${orgSlug}/classes/trainers`);
    return { ok: true, data: undefined };
  } catch (err) {
    return fail(err, "No se pudo actualizar el entrenador.");
  }
}

export async function deleteTrainer(orgSlug: string, id: string): Promise<ActionResult> {
  try {
    const { org, userId } = await requirePermission(orgSlug, { gymClass: ["update"] });

    await withTenant(org.id, async (tx) => {
      const [existing] = await tx
        .select()
        .from(trainers)
        .where(and(eq(trainers.id, id), eq(trainers.orgId, org.id), isNull(trainers.deletedAt)));

      if (!existing) {
        throw new Error("Entrenador no encontrado");
      }

      await tx
        .update(trainers)
        .set({ deletedAt: new Date(), isActive: false })
        .where(eq(trainers.id, id));

      await audit(tx, {
        orgId: org.id,
        actorId: userId,
        entity: "trainer",
        entityId: id,
        action: "trainer.delete",
        diff: { before: existing },
      });
    });

    revalidatePath(`/app/${orgSlug}/classes/trainers`);
    return { ok: true, data: undefined };
  } catch (err) {
    return fail(err, "No se pudo eliminar el entrenador.");
  }
}

// ---------------- CLASS TYPES ----------------

export async function createClassType(
  orgSlug: string,
  input: ClassTypeInput,
): Promise<ActionResult<{ id: string }>> {
  try {
    const { org, userId } = await requirePermission(orgSlug, { gymClass: ["create"] });
    const parsed = classTypeInputSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: "Datos de la modalidad inválidos." };
    }

    const type = await withTenant(org.id, async (tx) => {
      const [inserted] = await tx
        .insert(classTypes)
        .values({
          orgId: org.id,
          name: parsed.data.name,
          description: parsed.data.description ?? null,
          color: parsed.data.color,
          durationMinutes: parsed.data.durationMinutes,
          defaultCapacity: parsed.data.defaultCapacity,
          isActive: parsed.data.isActive,
        })
        .returning();

      await audit(tx, {
        orgId: org.id,
        actorId: userId,
        entity: "class_type",
        entityId: inserted.id,
        action: "class_type.create",
        diff: { after: inserted },
      });

      return inserted;
    });

    revalidatePath(`/app/${orgSlug}/classes/types`);
    return { ok: true, data: { id: type.id } };
  } catch (err) {
    return fail(err, "No se pudo crear la modalidad de clase.");
  }
}

export async function updateClassType(
  orgSlug: string,
  id: string,
  input: ClassTypeInput,
): Promise<ActionResult> {
  try {
    const { org, userId } = await requirePermission(orgSlug, { gymClass: ["update"] });
    const parsed = classTypeInputSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: "Datos de la modalidad inválidos." };
    }

    await withTenant(org.id, async (tx) => {
      const [existing] = await tx
        .select()
        .from(classTypes)
        .where(
          and(eq(classTypes.id, id), eq(classTypes.orgId, org.id), isNull(classTypes.deletedAt)),
        );

      if (!existing) {
        throw new Error("Modalidad no encontrada");
      }

      const [updated] = await tx
        .update(classTypes)
        .set({
          name: parsed.data.name,
          description: parsed.data.description ?? null,
          color: parsed.data.color,
          durationMinutes: parsed.data.durationMinutes,
          defaultCapacity: parsed.data.defaultCapacity,
          isActive: parsed.data.isActive,
        })
        .where(eq(classTypes.id, id))
        .returning();

      await audit(tx, {
        orgId: org.id,
        actorId: userId,
        entity: "class_type",
        entityId: id,
        action: "class_type.update",
        diff: { before: existing, after: updated },
      });
    });

    revalidatePath(`/app/${orgSlug}/classes/types`);
    return { ok: true, data: undefined };
  } catch (err) {
    return fail(err, "No se pudo actualizar la modalidad de clase.");
  }
}

export async function deleteClassType(orgSlug: string, id: string): Promise<ActionResult> {
  try {
    const { org, userId } = await requirePermission(orgSlug, { gymClass: ["update"] });

    await withTenant(org.id, async (tx) => {
      const [existing] = await tx
        .select()
        .from(classTypes)
        .where(
          and(eq(classTypes.id, id), eq(classTypes.orgId, org.id), isNull(classTypes.deletedAt)),
        );

      if (!existing) {
        throw new Error("Modalidad no encontrada");
      }

      await tx
        .update(classTypes)
        .set({ deletedAt: new Date(), isActive: false })
        .where(eq(classTypes.id, id));

      await audit(tx, {
        orgId: org.id,
        actorId: userId,
        entity: "class_type",
        entityId: id,
        action: "class_type.delete",
        diff: { before: existing },
      });
    });

    revalidatePath(`/app/${orgSlug}/classes/types`);
    return { ok: true, data: undefined };
  } catch (err) {
    return fail(err, "No se pudo eliminar la modalidad de clase.");
  }
}

// ---------------- CLASS SESSIONS ----------------

export async function createClassSession(
  orgSlug: string,
  input: ClassSessionInput,
): Promise<ActionResult<{ id: string }>> {
  try {
    const { org, userId } = await requirePermission(orgSlug, { gymClass: ["create"] });
    const parsed = classSessionInputSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: "Datos del horario de clase inválidos." };
    }

    const session = await withTenant(org.id, async (tx) => {
      const [inserted] = await tx
        .insert(classSessions)
        .values({
          orgId: org.id,
          classTypeId: parsed.data.classTypeId,
          trainerId: parsed.data.trainerId || null,
          branchId: parsed.data.branchId || null,
          date: parsed.data.date,
          startTime: parsed.data.startTime,
          endTime: parsed.data.endTime,
          capacity: parsed.data.capacity,
          status: "scheduled",
        })
        .returning();

      await audit(tx, {
        orgId: org.id,
        actorId: userId,
        entity: "class_session",
        entityId: inserted.id,
        action: "class_session.create",
        diff: { after: inserted },
      });

      return inserted;
    });

    revalidatePath(`/app/${orgSlug}/classes`);
    return { ok: true, data: { id: session.id } };
  } catch (err) {
    return fail(err, "No se pudo programar la sesión de clase.");
  }
}

export async function cancelClassSession(
  orgSlug: string,
  sessionId: string,
  reason?: string,
): Promise<ActionResult> {
  try {
    const { org, userId } = await requirePermission(orgSlug, { gymClass: ["cancel"] });

    await withTenant(org.id, async (tx) => {
      const [existing] = await tx
        .select()
        .from(classSessions)
        .where(
          and(
            eq(classSessions.id, sessionId),
            eq(classSessions.orgId, org.id),
            isNull(classSessions.deletedAt),
          ),
        );

      if (!existing) {
        throw new Error("Sesión de clase no encontrada");
      }

      const [updated] = await tx
        .update(classSessions)
        .set({
          status: "cancelled",
          cancelReason: reason?.trim() || "Cancelada por administración",
        })
        .where(eq(classSessions.id, sessionId))
        .returning();

      await audit(tx, {
        orgId: org.id,
        actorId: userId,
        entity: "class_session",
        entityId: sessionId,
        action: "class_session.cancel",
        diff: { before: existing, after: updated },
      });
    });

    revalidatePath(`/app/${orgSlug}/classes`);
    revalidatePath(`/app/${orgSlug}/classes/${sessionId}`);
    return { ok: true, data: undefined };
  } catch (err) {
    return fail(err, "No se pudo cancelar la sesión de clase.");
  }
}

// ---------------- BOOKINGS ----------------

export async function bookClassSession(
  orgSlug: string,
  input: ClassBookingInput,
): Promise<ActionResult<{ id: string }>> {
  try {
    const { org, userId } = await requirePermission(orgSlug, { gymClass: ["book"] });
    const parsed = classBookingInputSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: "Datos de reserva inválidos." };
    }

    const bookingResult = await withTenant(org.id, async (tx) => {
      // 1. Obtener la sesión
      const [session] = await tx
        .select()
        .from(classSessions)
        .where(
          and(
            eq(classSessions.id, parsed.data.sessionId),
            eq(classSessions.orgId, org.id),
            isNull(classSessions.deletedAt),
          ),
        );

      if (!session) {
        return { error: "La clase seleccionada no existe." };
      }

      if (session.status === "cancelled") {
        return { error: "No es posible inscribirse en una clase cancelada." };
      }

      // 2. Verificar socio
      const [member] = await tx
        .select()
        .from(members)
        .where(
          and(
            eq(members.id, parsed.data.memberId),
            eq(members.orgId, org.id),
            isNull(members.deletedAt),
          ),
        );

      if (!member) {
        return { error: "El socio seleccionado no existe." };
      }

      // 3. Revisar si ya tiene reserva para esta sesión
      const [existingBooking] = await tx
        .select()
        .from(classBookings)
        .where(
          and(
            eq(classBookings.sessionId, session.id),
            eq(classBookings.memberId, member.id),
            eq(classBookings.orgId, org.id),
            isNull(classBookings.deletedAt),
          ),
        );

      if (existingBooking && ["confirmed", "attended"].includes(existingBooking.status)) {
        return { error: "El socio ya se encuentra inscrito en esta clase." };
      }

      // 4. Verificar aforo disponible
      const [countResult] = await tx
        .select({
          total: sql<number>`count(${classBookings.id})::int`,
        })
        .from(classBookings)
        .where(
          and(
            eq(classBookings.sessionId, session.id),
            eq(classBookings.orgId, org.id),
            isNull(classBookings.deletedAt),
            inArray(classBookings.status, ["confirmed", "attended"]),
          ),
        );

      const currentCount = Number(countResult?.total ?? 0);
      if (currentCount >= session.capacity) {
        return { error: "El aforo de la clase está completo." };
      }

      // 5. Insertar o reactivar reserva
      let booking;
      if (existingBooking) {
        const [reactivated] = await tx
          .update(classBookings)
          .set({
            status: "confirmed",
            notes: parsed.data.notes ?? existingBooking.notes,
            bookedAt: new Date(),
          })
          .where(eq(classBookings.id, existingBooking.id))
          .returning();
        booking = reactivated;
      } else {
        const [inserted] = await tx
          .insert(classBookings)
          .values({
            orgId: org.id,
            sessionId: session.id,
            memberId: member.id,
            status: "confirmed",
            notes: parsed.data.notes ?? null,
          })
          .returning();
        booking = inserted;
      }

      await audit(tx, {
        orgId: org.id,
        actorId: userId,
        entity: "class_booking",
        entityId: booking.id,
        action: "class_booking.create",
        diff: { after: booking },
      });

      return { booking };
    });

    if ("error" in bookingResult && bookingResult.error) {
      return { ok: false, error: bookingResult.error };
    }

    revalidatePath(`/app/${orgSlug}/classes`);
    revalidatePath(`/app/${orgSlug}/classes/${input.sessionId}`);
    return { ok: true, data: { id: bookingResult.booking!.id } };
  } catch (err) {
    return fail(err, "No se pudo registrar la reserva.");
  }
}

export async function updateBookingStatus(
  orgSlug: string,
  input: UpdateBookingStatusInput,
): Promise<ActionResult> {
  try {
    const { org, userId } = await requirePermission(orgSlug, { gymClass: ["update"] });
    const parsed = updateBookingStatusSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: "Datos de reserva inválidos." };
    }

    const sessionId = await withTenant(org.id, async (tx) => {
      const [existing] = await tx
        .select()
        .from(classBookings)
        .where(
          and(
            eq(classBookings.id, parsed.data.bookingId),
            eq(classBookings.orgId, org.id),
            isNull(classBookings.deletedAt),
          ),
        );

      if (!existing) {
        throw new Error("Reserva no encontrada");
      }

      const [updated] = await tx
        .update(classBookings)
        .set({ status: parsed.data.status })
        .where(eq(classBookings.id, parsed.data.bookingId))
        .returning();

      await audit(tx, {
        orgId: org.id,
        actorId: userId,
        entity: "class_booking",
        entityId: parsed.data.bookingId,
        action: "class_booking.update_status",
        diff: { before: existing, after: updated },
      });

      return existing.sessionId;
    });

    revalidatePath(`/app/${orgSlug}/classes`);
    revalidatePath(`/app/${orgSlug}/classes/${sessionId}`);
    return { ok: true, data: undefined };
  } catch (err) {
    return fail(err, "No se pudo actualizar el estado de la reserva.");
  }
}

export async function cancelBooking(orgSlug: string, bookingId: string): Promise<ActionResult> {
  return updateBookingStatus(orgSlug, { bookingId, status: "cancelled" });
}
