import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { admin as adminPlugin, organization } from "better-auth/plugins";
import { db } from "@/db";
import * as authSchema from "@/db/schema/auth-schema";
import { ac, organizationAdditionalFields, platformAc, platformRoles, roles } from "./permissions";

const isBuildPhase =
  process.env.NEXT_PHASE === "phase-production-build" ||
  process.env.npm_lifecycle_event === "build";

export const auth = betterAuth({
  appName: "AdminFit",
  database: drizzleAdapter(db, { provider: "pg", schema: authSchema }),
  baseURL: process.env.BETTER_AUTH_URL,
  secret:
    process.env.BETTER_AUTH_SECRET ||
    (isBuildPhase ? "build-time-placeholder-not-used-at-runtime" : undefined),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    maxPasswordLength: 128,
    autoSignIn: true,
    requireEmailVerification: false,
  },
  user: {
    deleteUser: { enabled: true },
  },
  session: {
    cookieCache: { enabled: true, maxAge: 5 * 60 },
  },
  // Solo en producción (default de Better Auth): sign-up/sign-in limitan a 3 req/10s por IP,
  // lo que rompería los e2e locales que registran varias cuentas seguidas.
  rateLimit: {
    enabled: process.env.NODE_ENV === "production",
    window: 60,
    max: 100,
  },
  plugins: [
    organization({
      ac,
      roles,
      creatorRole: "owner",
      allowUserToCreateOrganization: true,
      organizationLimit: 5,
      invitationExpiresIn: 60 * 60 * 24 * 7,
      schema: { organization: { additionalFields: organizationAdditionalFields } },
      // Fase 1: sin email transaccional aún. La invitación se acepta desde /invite/[id];
      // el link se muestra al invitador en la página de equipo.
      sendInvitationEmail: async () => {},
    }),
    // Rol de plataforma (superadmin): user.role, impersonación y suspensión de usuarios.
    adminPlugin({
      ac: platformAc,
      roles: platformRoles,
      defaultRole: "user",
      adminRoles: ["superadmin"],
    }),
    nextCookies(),
  ],
  advanced: {
    useSecureCookies: (process.env.BETTER_AUTH_URL ?? "").startsWith("https://"),
  },
});

export type Auth = typeof auth;
export type Session = Auth["$Infer"]["Session"];
