import { and, asc, desc, eq, gte, inArray, isNull, lte, sql } from "drizzle-orm";
import {
  branches,
  classBookings,
  classSessions,
  classTypes,
  members,
  trainers,
  type ClassBooking,
  type ClassSession,
  type ClassType,
  type Trainer,
} from "@/db/schema";
import { withTenant } from "@/lib/tenant";

export type SessionListItem = ClassSession & {
  classType: ClassType;
  trainer: Trainer | null;
  branchName: string | null;
  bookedCount: number;
};

export type SessionDetails = ClassSession & {
  classType: ClassType;
  trainer: Trainer | null;
  branchName: string | null;
  bookedCount: number;
  bookings: Array<
    ClassBooking & {
      member: {
        id: string;
        firstName: string;
        lastName: string;
        documentType: string;
        documentNumber: string;
        photoUrl: string | null;
        phone: string | null;
      };
    }
  >;
};

export async function listTrainers(orgId: string, onlyActive = false): Promise<Trainer[]> {
  return withTenant(orgId, async (tx) => {
    const conditions = [eq(trainers.orgId, orgId), isNull(trainers.deletedAt)];
    if (onlyActive) {
      conditions.push(eq(trainers.isActive, true));
    }
    return tx
      .select()
      .from(trainers)
      .where(and(...conditions))
      .orderBy(asc(trainers.firstName), asc(trainers.lastName));
  });
}

export async function listClassTypes(orgId: string, onlyActive = false): Promise<ClassType[]> {
  return withTenant(orgId, async (tx) => {
    const conditions = [eq(classTypes.orgId, orgId), isNull(classTypes.deletedAt)];
    if (onlyActive) {
      conditions.push(eq(classTypes.isActive, true));
    }
    return tx
      .select()
      .from(classTypes)
      .where(and(...conditions))
      .orderBy(asc(classTypes.name));
  });
}

export async function listClassSessions(
  orgId: string,
  filters: {
    startDate?: string;
    endDate?: string;
    trainerId?: string;
    classTypeId?: string;
    branchId?: string;
  } = {},
): Promise<SessionListItem[]> {
  return withTenant(orgId, async (tx) => {
    const conditions = [eq(classSessions.orgId, orgId), isNull(classSessions.deletedAt)];

    if (filters.startDate) {
      conditions.push(gte(classSessions.date, filters.startDate));
    }
    if (filters.endDate) {
      conditions.push(lte(classSessions.date, filters.endDate));
    }
    if (filters.trainerId) {
      conditions.push(eq(classSessions.trainerId, filters.trainerId));
    }
    if (filters.classTypeId) {
      conditions.push(eq(classSessions.classTypeId, filters.classTypeId));
    }
    if (filters.branchId) {
      conditions.push(eq(classSessions.branchId, filters.branchId));
    }

    const rows = await tx
      .select({
        session: classSessions,
        classType: classTypes,
        trainer: trainers,
        branchName: branches.name,
      })
      .from(classSessions)
      .innerJoin(classTypes, eq(classTypes.id, classSessions.classTypeId))
      .leftJoin(trainers, eq(trainers.id, classSessions.trainerId))
      .leftJoin(branches, eq(branches.id, classSessions.branchId))
      .where(and(...conditions))
      .orderBy(asc(classSessions.date), asc(classSessions.startTime));

    if (rows.length === 0) return [];

    const sessionIds = rows.map((r) => r.session.id);
    const bookingCounts = await tx
      .select({
        sessionId: classBookings.sessionId,
        count: sql<number>`count(${classBookings.id})::int`,
      })
      .from(classBookings)
      .where(
        and(
          eq(classBookings.orgId, orgId),
          isNull(classBookings.deletedAt),
          inArray(classBookings.sessionId, sessionIds),
          inArray(classBookings.status, ["confirmed", "attended"]),
        ),
      )
      .groupBy(classBookings.sessionId);

    const countMap = new Map<string, number>();
    for (const bc of bookingCounts) {
      countMap.set(bc.sessionId, Number(bc.count));
    }

    return rows.map((r) => ({
      ...r.session,
      classType: r.classType,
      trainer: r.trainer,
      branchName: r.branchName,
      bookedCount: countMap.get(r.session.id) ?? 0,
    }));
  });
}

export async function getSessionWithDetails(
  orgId: string,
  sessionId: string,
): Promise<SessionDetails | null> {
  return withTenant(orgId, async (tx) => {
    const [row] = await tx
      .select({
        session: classSessions,
        classType: classTypes,
        trainer: trainers,
        branchName: branches.name,
      })
      .from(classSessions)
      .innerJoin(classTypes, eq(classTypes.id, classSessions.classTypeId))
      .leftJoin(trainers, eq(trainers.id, classSessions.trainerId))
      .leftJoin(branches, eq(branches.id, classSessions.branchId))
      .where(
        and(
          eq(classSessions.id, sessionId),
          eq(classSessions.orgId, orgId),
          isNull(classSessions.deletedAt),
        ),
      );

    if (!row) return null;

    const bookingsRows = await tx
      .select({
        booking: classBookings,
        member: {
          id: members.id,
          firstName: members.firstName,
          lastName: members.lastName,
          documentType: members.documentType,
          documentNumber: members.documentNumber,
          photoUrl: members.photoUrl,
          phone: members.phone,
        },
      })
      .from(classBookings)
      .innerJoin(members, eq(members.id, classBookings.memberId))
      .where(
        and(
          eq(classBookings.sessionId, sessionId),
          eq(classBookings.orgId, orgId),
          isNull(classBookings.deletedAt),
        ),
      )
      .orderBy(desc(classBookings.bookedAt));

    const activeBookings = bookingsRows.filter((b) =>
      ["confirmed", "attended"].includes(b.booking.status),
    );

    return {
      ...row.session,
      classType: row.classType,
      trainer: row.trainer,
      branchName: row.branchName,
      bookedCount: activeBookings.length,
      bookings: bookingsRows.map((b) => ({
        ...b.booking,
        member: b.member,
      })),
    };
  });
}
