import { describe, expect, it } from "vitest";
import { roleCan } from "@/lib/auth/authorize";
import type { Permissions } from "@/lib/auth/authorize";
import type { OrgRole } from "@/lib/auth/permissions";

// Matriz de la Fase 5 (ver plan "Las cuentas del gym"): codifica qué puede ver/hacer cada
// rol para la info sensible del negocio. Si alguien cambia `permissions.ts` sin querer,
// este test lo revela antes que un e2e o, peor, un usuario real.
const MATRIX: Array<{ perms: Permissions; owner: boolean; admin: boolean; staff: boolean }> = [
  { perms: { finance: ["read"] }, owner: true, admin: true, staff: false },
  { perms: { payment: ["create"] }, owner: true, admin: true, staff: true },
  { perms: { payment: ["void"] }, owner: true, admin: true, staff: false },
  { perms: { payment: ["readAll"] }, owner: true, admin: true, staff: false },
  { perms: { expense: ["create"] }, owner: true, admin: true, staff: true },
  { perms: { expense: ["readAll"] }, owner: true, admin: true, staff: false },
  { perms: { expense: ["readPayroll"] }, owner: true, admin: false, staff: false },
  { perms: { expense: ["void"] }, owner: true, admin: true, staff: false },
  { perms: { cashClosure: ["create"] }, owner: true, admin: true, staff: true },
  { perms: { cashClosure: ["reopen"] }, owner: true, admin: true, staff: false },
  { perms: { debt: ["read"] }, owner: true, admin: true, staff: true },
  { perms: { report: ["read"] }, owner: true, admin: true, staff: false },
  { perms: { report: ["export"] }, owner: true, admin: true, staff: false },
  { perms: { settings: ["read"] }, owner: true, admin: true, staff: false },
];

describe("matriz de permisos por rol (Fase 5)", () => {
  for (const { perms, owner, admin, staff } of MATRIX) {
    const label = Object.entries(perms)
      .map(([k, v]) => `${k}:${(v as string[]).join("/")}`)
      .join(" ");
    const expected: Record<OrgRole, boolean> = { owner, admin, staff };
    for (const role of Object.keys(expected) as OrgRole[]) {
      it(`${role} ${expected[role] ? "sí" : "no"} puede ${label}`, () => {
        expect(roleCan(role, perms)).toBe(expected[role]);
      });
    }
  }
});
