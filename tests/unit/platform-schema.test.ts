import { describe, expect, it } from "vitest";
import {
  assignSubscriptionSchema,
  platformPlanSchema,
  platformSettingsSchema,
} from "@/modules/platform/schema";

describe("platformPlanSchema", () => {
  it("valida y transforma un plan SaaS válido con precio en pesos", () => {
    const res = platformPlanSchema.safeParse({
      name: "Plan Básico",
      description: "Gimnasios pequeños",
      price: "120.000",
      maxMembers: 100,
      maxBranches: 1,
      maxStaff: 3,
      isActive: true,
    });
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data.name).toBe("Plan Básico");
      expect(res.data.price).toBe(120_000_00); // 120.000 pesos en centavos
      expect(res.data.maxMembers).toBe(100);
      expect(res.data.maxBranches).toBe(1);
      expect(res.data.maxStaff).toBe(3);
    }
  });

  it("acepta límites nulos o vacíos para representar ilimitado", () => {
    const res = platformPlanSchema.safeParse({
      name: "Plan Ilimitado",
      price: "350000",
      maxMembers: "",
      maxBranches: null,
      maxStaff: undefined,
    });
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data.price).toBe(350_000_00);
      expect(res.data.maxMembers).toBeNull();
      expect(res.data.maxBranches).toBeNull();
      expect(res.data.maxStaff).toBeNull();
    }
  });

  it("rechaza precio en cero o vacío", () => {
    expect(
      platformPlanSchema.safeParse({
        name: "Plan Inválido",
        price: "0",
      }).success,
    ).toBe(false);

    expect(
      platformPlanSchema.safeParse({
        name: "Plan Inválido",
        price: "",
      }).success,
    ).toBe(false);
  });

  it("rechaza nombre muy corto", () => {
    expect(
      platformPlanSchema.safeParse({
        name: "A",
        price: "100000",
      }).success,
    ).toBe(false);
  });
});

describe("assignSubscriptionSchema", () => {
  const validUuid = "11111111-1111-4111-8111-111111111111";

  it("acepta asignación válida", () => {
    const res = assignSubscriptionSchema.safeParse({
      orgId: "org_abc123",
      planId: validUuid,
      durationDays: 30,
      status: "active",
      notes: "Pago recibido por Bancolombia",
    });
    expect(res.success).toBe(true);
  });

  it("acepta estado trial", () => {
    const res = assignSubscriptionSchema.safeParse({
      orgId: "org_abc123",
      planId: validUuid,
      durationDays: 14,
      status: "trial",
    });
    expect(res.success).toBe(true);
  });

  it("rechaza planId que no sea UUID", () => {
    const res = assignSubscriptionSchema.safeParse({
      orgId: "org_abc123",
      planId: "not-a-uuid",
      durationDays: 30,
      status: "active",
    });
    expect(res.success).toBe(false);
  });

  it("rechaza duración negativa o mayor a 2 años", () => {
    expect(
      assignSubscriptionSchema.safeParse({
        orgId: "org_abc123",
        planId: validUuid,
        durationDays: 0,
        status: "active",
      }).success,
    ).toBe(false);

    expect(
      assignSubscriptionSchema.safeParse({
        orgId: "org_abc123",
        planId: validUuid,
        durationDays: 800,
        status: "active",
      }).success,
    ).toBe(false);
  });
});

describe("platformSettingsSchema", () => {
  it("acepta configuración bancaria completa", () => {
    const res = platformSettingsSchema.safeParse({
      bankHolderName: "Manuel Francisco Amell",
      bankName: "Bancolombia",
      bankAccountType: "ahorros",
      bankAccountNumber: "123-456789-00",
      nequiNumber: "3001234567",
      additionalInfo: "Enviar comprobante a soporte.",
    });
    expect(res.success).toBe(true);
  });

  it("acepta campos opcionales vacíos", () => {
    const res = platformSettingsSchema.safeParse({
      bankHolderName: "",
      bankName: "",
      bankAccountType: null,
      bankAccountNumber: "",
      nequiNumber: "",
      additionalInfo: "",
    });
    expect(res.success).toBe(true);
  });
});
