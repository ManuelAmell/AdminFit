import { headers } from "next/headers";
import { auth } from "./auth";
import { roleCan, type Permissions } from "./permissions";
import { requireOrg, type OrgContext } from "./session";

// roleCan/can/Permissions viven en permissions.ts (sin imports server-only) y se
// re-exportan aquí para no romper los imports existentes desde @/lib/auth/authorize.
export { roleCan, can, type Permissions } from "./permissions";

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
