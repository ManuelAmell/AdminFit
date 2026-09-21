import { and, eq } from "drizzle-orm";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";
import { db } from "@/db";
import { member, organization } from "@/db/schema";
import { auth } from "./auth";
import type { OrgRole } from "./permissions";

// Una sola lectura de sesión por request (layout + page comparten el resultado).
export const getCurrentSession = cache(async () => {
  return auth.api.getSession({ headers: await headers() });
});

// Nunca envolver en try/catch: redirect() lanza NEXT_REDIRECT.
export async function requireUser() {
  const session = await getCurrentSession();
  if (!session?.user) redirect("/login");
  return session;
}

export type OrgContext = {
  org: typeof organization.$inferSelect;
  role: OrgRole;
  userId: string;
  isSuperadmin: boolean;
};

// Resuelve la org por slug y verifica que el usuario pertenece a ella.
// Superadmin puede entrar a cualquier org (solo lectura se aplica en la UI/acciones).
export const requireOrg = cache(async (slug: string): Promise<OrgContext> => {
  const session = await requireUser();
  const userId = session.user.id;
  const isSuperadmin = session.user.role === "superadmin";

  const org = await db.query.organization.findFirst({ where: eq(organization.slug, slug) });
  if (!org) notFound();

  const membership = await db.query.member.findFirst({
    where: and(eq(member.organizationId, org.id), eq(member.userId, userId)),
  });

  if (!membership && !isSuperadmin) notFound();
  if (org.status === "suspended" && !isSuperadmin) redirect("/suspended");

  return {
    org,
    role: (membership?.role ?? "admin") as OrgRole,
    userId,
    isSuperadmin,
  };
});

export async function requireSuperadmin() {
  const session = await requireUser();
  if (session.user.role !== "superadmin") notFound();
  return session;
}

// Para Route Handlers: devuelve null en vez de redirigir (el caller responde 401).
export async function getApiUser() {
  const session = await getCurrentSession();
  return session?.user ?? null;
}
