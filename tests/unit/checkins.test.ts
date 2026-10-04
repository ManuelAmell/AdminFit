import { describe, expect, it } from "vitest";
import type { Member, Plan, Subscription } from "@/db/schema";
import { evaluateCheckin } from "@/modules/checkins/rules";

const baseMember: Member = {
  id: "member-1",
  orgId: "org-1",
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
  documentType: "CC",
  documentNumber: "12345678",
  firstName: "Juan",
  lastName: "Pérez",
  email: "juan@example.com",
  phone: "3001234567",
  birthDate: "1995-05-10",
  gender: "male",
  photoUrl: null,
  emergencyContactName: null,
  emergencyContactPhone: null,
  notes: null,
  status: "active",
  branchId: null,
};

const basePlan: Plan = {
  id: "plan-1",
  orgId: "org-1",
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
  name: "Plan Mensual",
  description: null,
  priceCents: 12000000,
  durationType: "months",
  durationValue: 1,
  visitLimit: null,
  color: "orange",
  isActive: true,
  sortOrder: 0,
};

const baseSub: Subscription & { plan: Plan } = {
  id: "sub-1",
  orgId: "org-1",
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
  memberId: "member-1",
  planId: "plan-1",
  startDate: "2026-03-01",
  endDate: "2026-03-31",
  status: "active",
  frozenAt: null,
  frozenUntil: null,
  cancelledAt: null,
  cancelReason: null,
  priceCentsSnapshot: 12000000,
  visitLimitSnapshot: null,
  visitsUsed: 0,
  notes: null,
  soldBy: null,
  plan: basePlan,
};

describe("evaluateCheckin", () => {
  it("rechaza si el socio está suspendido", () => {
    const res = evaluateCheckin({ ...baseMember, status: "suspended" }, baseSub, 3, "2026-03-15");
    expect(res.status).toBe("rejected");
    expect(res.reason).toMatch(/suspendido/);
  });

  it("rechaza si el socio está inactivo", () => {
    const res = evaluateCheckin({ ...baseMember, status: "inactive" }, baseSub, 3, "2026-03-15");
    expect(res.status).toBe("rejected");
    expect(res.reason).toMatch(/inactivo/);
  });

  it("rechaza si no tiene ninguna membresía", () => {
    const res = evaluateCheckin(baseMember, null, 3, "2026-03-15");
    expect(res.status).toBe("rejected");
    expect(res.reason).toMatch(/no tiene ninguna membresía/);
  });

  it("rechaza si la membresía está cancelada", () => {
    const res = evaluateCheckin(baseMember, { ...baseSub, status: "cancelled" }, 3, "2026-03-15");
    expect(res.status).toBe("rejected");
    expect(res.reason).toMatch(/cancelada/);
  });

  it("rechaza si la membresía está congelada", () => {
    const res = evaluateCheckin(
      baseMember,
      { ...baseSub, status: "frozen", frozenUntil: "2026-03-25" },
      3,
      "2026-03-15",
    );
    expect(res.status).toBe("rejected");
    expect(res.reason).toMatch(/congelada/);
  });

  it("rechaza si se alcanzó el límite de visitas", () => {
    const visitSub = {
      ...baseSub,
      visitLimitSnapshot: 10,
      visitsUsed: 10,
    };
    const res = evaluateCheckin(baseMember, visitSub, 3, "2026-03-15");
    expect(res.status).toBe("rejected");
    expect(res.reason).toMatch(/Límite de visitas alcanzado/);
    expect(res.shouldIncrementVisits).toBe(false);
  });

  it("permite e incrementa visitas si no se ha alcanzado el límite", () => {
    const visitSub = {
      ...baseSub,
      visitLimitSnapshot: 10,
      visitsUsed: 5,
    };
    const res = evaluateCheckin(baseMember, visitSub, 3, "2026-03-15");
    expect(res.status).toBe("granted");
    expect(res.shouldIncrementVisits).toBe(true);
    expect(res.reason).toMatch(/Visita 6\/10/);
  });

  it("permite acceso al día si la fecha fin es posterior a hoy", () => {
    const res = evaluateCheckin(baseMember, baseSub, 3, "2026-03-15");
    expect(res.status).toBe("granted");
    expect(res.reason).toMatch(/al día/);
  });

  it("permite acceso con aviso si está en período de gracia", () => {
    // sub terminó el 2026-03-31, hoy es 2026-04-02 (2 días después, gracia es 3 días)
    const res = evaluateCheckin(baseMember, baseSub, 3, "2026-04-02");
    expect(res.status).toBe("granted");
    expect(res.reason).toMatch(/período de gracia/);
  });

  it("rechaza si la fecha fin venció y se agotó el período de gracia", () => {
    // sub terminó el 2026-03-31, hoy es 2026-04-05 (5 días después, gracia es 3 días)
    const res = evaluateCheckin(baseMember, baseSub, 3, "2026-04-05");
    expect(res.status).toBe("rejected");
    expect(res.reason).toMatch(/vencida/);
  });
});
