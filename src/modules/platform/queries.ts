import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { platformPlans, tenantSubscriptions, platformSettings } from "@/db/schema";

// --- Planes SaaS ---

export async function listPlatformPlans() {
  return db.query.platformPlans.findMany({
    orderBy: [platformPlans.sortOrder, platformPlans.createdAt],
  });
}

export async function listActivePlatformPlans() {
  return db.query.platformPlans.findMany({
    where: eq(platformPlans.isActive, true),
    orderBy: [platformPlans.sortOrder, platformPlans.createdAt],
  });
}

export async function getPlatformPlan(id: string) {
  return (
    (await db.query.platformPlans.findFirst({
      where: eq(platformPlans.id, id),
    })) ?? null
  );
}

// --- Suscripciones de tenants ---

// La suscripción vigente de un tenant es la más reciente.
export async function getCurrentSubscription(orgId: string) {
  return (
    (await db.query.tenantSubscriptions.findFirst({
      where: eq(tenantSubscriptions.orgId, orgId),
      orderBy: desc(tenantSubscriptions.createdAt),
      with: { plan: true },
    })) ?? null
  );
}

export async function getSubscriptionHistory(orgId: string) {
  return db.query.tenantSubscriptions.findMany({
    where: eq(tenantSubscriptions.orgId, orgId),
    orderBy: desc(tenantSubscriptions.createdAt),
    with: { plan: true, assignedByUser: true },
  });
}

// --- Configuración de plataforma ---

export async function getPlatformSettings() {
  const rows = await db.select().from(platformSettings).limit(1);
  return rows[0] ?? null;
}
