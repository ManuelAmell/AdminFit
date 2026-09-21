import { headers } from "next/headers";
import { auth } from "./auth";
import { roles, statements, type OrgRole } from "./permissions";
import { requireOrg, type OrgContext } from "./session";

type StatementKey = keyof typeof statements;
export type Permissions = { [K in StatementKey]?: (typeof statements)[K][number][] };

// Comprueba en memoria (sin DB extra) si el rol de la org permite la acción.
export function roleCan(role: OrgRole, permissions: Permissions): boolean {
  const r = roles[role];
  if (!r) return false;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return r.authorize(permissions as any).success;
}

export class ForbiddenError extends Error {
  constructor(message = "No tienes permiso para esta acción.") {
    super(message);
    this.name = "ForbiddenError";
  }
}

// Para Server Actions: resuelve la org por slug y exige el permiso. Superadmin siempre puede.
export async function requirePermission(
  orgSlug: string,
  permissions: Permissions,
): Promise<OrgContext> {
  const ctx = await requireOrg(orgSlug);
  if (ctx.isSuperadmin) return ctx;
  if (!roleCan(ctx.role, permissions)) throw new ForbiddenError();
  return ctx;
}

// Variante que consulta a Better Auth (útil si el rol cambió en esta sesión).
export async function hasPermissionRemote(permissions: Permissions) {
  const res = await auth.api.hasPermission({
    headers: await headers(),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    body: { permissions: permissions as any },
  });
  return res.success;
}
