import { auditLog } from "@/db/schema";
import type { TenantDb } from "@/lib/tenant";

// Llamar dentro de withTenant() en toda mutación de negocio.
export async function audit(
  tx: TenantDb,
  entry: {
    orgId: string;
    actorId: string | null;
    action: string; // ej: "member.create", "payment.void"
    entity: string; // ej: "member"
    entityId?: string | null;
    diff?: Record<string, unknown> | null;
  },
) {
  await tx.insert(auditLog).values({
    orgId: entry.orgId,
    actorId: entry.actorId,
    action: entry.action,
    entity: entry.entity,
    entityId: entry.entityId ?? null,
    diff: entry.diff ?? null,
  });
}
