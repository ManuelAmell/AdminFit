import { describe, expect, it, vi } from "vitest";
import * as authorizeModule from "@/lib/auth/authorize";
import type { OrgContext } from "@/lib/auth/session";
import { exportReportCsvAction } from "@/modules/reports/actions";
import * as queriesModule from "@/modules/reports/queries";

describe("exportReportCsvAction", () => {
  it("falla con ForbiddenError si el usuario no tiene permiso report:export", async () => {
    vi.spyOn(authorizeModule, "requirePermission").mockRejectedValueOnce(
      new authorizeModule.ForbiddenError("No tienes permiso para esta acción."),
    );

    const result = await exportReportCsvAction("mi-gym", { range: "month" });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe("No tienes permiso para esta acción.");
    }
  });

  it("retorna el CSV cuando el usuario tiene permiso report:export", async () => {
    vi.spyOn(authorizeModule, "requirePermission").mockResolvedValueOnce({
      org: { id: "org-1", name: "Gym Test", slug: "gym-test" },
      role: "owner",
      userId: "user-1",
      user: {
        id: "user-1",
        name: "Owner",
        email: "owner@test.com",
        emailVerified: true,
        role: "user",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      session: {
        id: "sess-1",
        userId: "user-1",
        token: "tok",
        expiresAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      isSuperadmin: false,
    } as unknown as OrgContext);

    vi.spyOn(queriesModule, "getReportExportData").mockResolvedValueOnce({
      orgName: "Gym Test",
      dateRange: { fromISO: "2026-03-01", toISO: "2026-03-31", preset: "month" },
      summary: {
        totalRevenueCents: 10000000,
        totalPayments: 1,
        newMembersCount: 1,
        renewalsCount: 0,
        expirationsCount: 0,
      },
      byPlan: [],
      byMethod: [],
      paymentsDetail: [],
    });

    const result = await exportReportCsvAction("gym-test", { range: "month" });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.startsWith("\uFEFF")).toBe(true);
      expect(result.data).toContain("Gym Test");
    }
  });
});
