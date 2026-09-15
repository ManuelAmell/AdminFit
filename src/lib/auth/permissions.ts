import { createAccessControl } from "better-auth/plugins/access";
import { defaultStatements as adminDefaultStatements } from "better-auth/plugins/admin/access";
import { defaultStatements } from "better-auth/plugins/organization/access";

// Statements de negocio (además de los que trae el plugin: organization, member, invitation, team, ac).
// "member" aquí es el miembro del equipo (usuario de la org); el socio del gym es "gymMember".
export const statements = {
  ...defaultStatements,
  gymMember: ["create", "read", "update", "delete", "import"],
  plan: ["create", "read", "update", "archive"],
  subscription: ["create", "read", "renew", "freeze", "cancel"],
  payment: ["create", "read", "void"],
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
  payment: ["create", "read", "void"],
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
  payment: ["create", "read", "void"],
  report: ["read", "export"],
  settings: ["read", "update"],
});

// Recepción: opera el día a día, no toca configuración ni anula pagos.
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
  report: ["read"],
  settings: ["read"],
});

export const roles = { owner, admin, staff } as const;
export type OrgRole = keyof typeof roles;
export const ORG_ROLES = Object.keys(roles) as OrgRole[];

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
