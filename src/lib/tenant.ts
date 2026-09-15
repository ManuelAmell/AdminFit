import { sql } from "drizzle-orm";
import { db, type Database } from "@/db";

type Tx = Parameters<Parameters<Database["transaction"]>[0]>[0];
export type TenantDb = Tx;

// Toda query de negocio pasa por aquí: fija app.org_id para la transacción y las
// policies RLS (drizzle/*_rls.sql) filtran por ese valor. Sin org_id, RLS no devuelve filas.
export async function withTenant<T>(orgId: string, fn: (tx: TenantDb) => Promise<T>): Promise<T> {
  if (!orgId) throw new Error("withTenant: orgId requerido");
  return db.transaction(async (tx) => {
    await tx.execute(sql`select set_config('app.org_id', ${orgId}, true)`);
    return fn(tx);
  });
}

// Solo para superadmin, migraciones y seeds: ignora RLS dentro de la transacción.
export async function withPlatform<T>(fn: (tx: TenantDb) => Promise<T>): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`select set_config('app.bypass_rls', 'on', true)`);
    return fn(tx);
  });
}
