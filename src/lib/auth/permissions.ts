import { createAccessControl } from "better-auth/plugins/access";
import { defaultStatements as adminDefaultStatements } from "better-auth/plugins/admin/access";
import { defaultStatements } from "better-auth/plugins/organization/access";

// Statements de negocio (además de los que trae el plugin: organization, member, invitation, team, ac).
// "member" aquí es el miembro del equipo (usuario de la org); el socio del gym es "gymMember".
//
// `finance` protege las cifras agregadas del negocio (ingresos, utilidad, KPIs de dinero):
// Recepción no lo tiene, así que el dashboard y los reportes le ocultan esos totales.
// `payment.readAll` distingue ver los propios pagos/cierres (Recepción) de ver los de todos
// los usuarios y sedes (owner/admin). `expense.readPayroll` oculta la categoría nómina.
export const statements = {
  ...defaultStatements,
  gymMember: ["create", "read", "update", "delete", "import"],
  plan: ["create", "read", "update", "archive"],
  subscription: ["create", "read", "renew", "freeze", "cancel"],
  payment: ["create", "read", "readAll", "void"],
  expense: ["create", "read", "readAll", "readPayroll", "void"],
  cashClosure: ["create", "read", "readAll", "reopen"],
  debt: ["read"],
  finance: ["read"],
  report: ["read", "export"],
  settings: ["read", "update"],
} as const;

export const ac = createAccessControl(statements);

export const owner = ac.newRole({
  organization: ["update", "delete"],
  member: ["create", "update", "delete"],
  invitation: ["create", "cancel"],
  team: ["create", "update", "delete"],
  ac: ["create", "read", "update", "delete"],
  gymMember: ["create", "read", "update", "delete", "import"],
  plan: ["create", "read", "update", "archive"],
  subscription: ["create", "read", "renew", "freeze", "cancel"],
  payment: ["create", "read", "readAll", "void"],
  expense: ["create", "read", "readAll", "readPayroll", "void"],
  cashClosure: ["create", "read", "readAll", "reopen"],
  debt: ["read"],
  finance: ["read"],
  report: ["read", "export"],
  settings: ["read", "update"],
});

export const admin = ac.newRole({
  organization: ["update"],
  member: ["create", "update", "delete"],
  invitation: ["create", "cancel"],
  team: ["create", "update", "delete"],
  ac: ["read"],
  gymMember: ["create", "read", "update", "delete", "import"],
  plan: ["create", "read", "update", "archive"],
  subscription: ["create", "read", "renew", "freeze", "cancel"],
  payment: ["create", "read", "readAll", "void"],
  // Administrador gestiona todo excepto eliminar el gimnasio, pero la nómina queda reservada
  // al propietario (compensación del equipo es sensible incluso para un admin de confianza).
  expense: ["create", "read", "readAll", "void"],
  cashClosure: ["create", "read", "readAll", "reopen"],
  debt: ["read"],
  finance: ["read"],
  report: ["read", "export"],
  settings: ["read", "update"],
});

// Recepción: opera el día a día, no toca configuración ni anula pagos. Solo ve sus propios
// cobros, gastos de caja menor y cierres — nunca los totales del negocio ni los de otros.
export const staff = ac.newRole({
  organization: [],
  member: [],
  invitation: [],
  team: [],
  ac: ["read"],
  gymMember: ["create", "read", "update"],
  plan: ["read"],
  subscription: ["create", "read", "renew", "freeze"],
  payment: ["create", "read"],
  expense: ["create", "read"],
  cashClosure: ["create", "read"],
  debt: ["read"],
  finance: [],
  report: [],
  settings: [],
});

export const roles = { owner, admin, staff } as const;
export type OrgRole = keyof typeof roles;
export const ORG_ROLES = Object.keys(roles) as OrgRole[];

type StatementKey = keyof typeof statements;
export type Permissions = { [K in StatementKey]?: (typeof statements)[K][number][] };

// Comprueba en memoria (sin DB extra) si el rol de la org permite la acción. Vive aquí (no
// en authorize.ts) porque este archivo no importa nada server-only: app-nav.ts lo usa desde
// un Client Component (AppSidebar) para filtrar el menú, y no puede arrastrar `./auth`/`db`
// al bundle del navegador.
export function roleCan(role: OrgRole, permissions: Permissions): boolean {
  const r = roles[role];
  if (!r) return false;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return r.authorize(permissions as any).success;
}

// Azúcar para páginas/componentes: superadmin siempre puede, si no, delega en roleCan.
// Reemplaza el patrón repetido `isSuperadmin || roleCan(role, {...})`.
export function can(ctx: { role: OrgRole; isSuperadmin: boolean }, permissions: Permissions) {
  return ctx.isSuperadmin || roleCan(ctx.role, permissions);
}

// Roles de plataforma (campo user.role, plugin admin): "user" normal y "superadmin" (tú).
export const platformAc = createAccessControl(adminDefaultStatements);
export const platformRoles = {
  user: platformAc.newRole({ user: [], session: [] }),
  superadmin: platformAc.newRole({
    user: [
      "create",
      "list",
      "set-role",
      "ban",
      "impersonate",
      "delete",
      "set-password",
      "set-email",
      "get",
      "update",
    ],
    session: ["list", "revoke", "delete"],
  }),
} as const;
export type PlatformRole = keyof typeof platformRoles;

// Campos extra de organization; compartido entre auth.ts (server) y client.ts para tipar
// organization.create() con city/timezone/currency.
export const organizationAdditionalFields = {
  timezone: { type: "string", required: false, defaultValue: "America/Bogota" },
  currency: { type: "string", required: false, defaultValue: "COP" },
  city: { type: "string", required: false },
  status: { type: "string", required: false, defaultValue: "active" },
} as const;
