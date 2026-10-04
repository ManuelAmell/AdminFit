import "dotenv/config";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

// Los tests de integración usan la DB real de DATABASE_URL (Postgres local en 5433).
// Se ejecutan las migraciones una vez por corrida.
export async function setup() {
  const url = process.env.DATABASE_URL;
  if (!url) return;
  try {
    const client = postgres(url, { max: 1, connect_timeout: 1 });
    await client`SELECT 1`;
    await migrate(drizzle(client), { migrationsFolder: "./drizzle" });
    await client.end();
  } catch {
    // Si Postgres local no está levantado, omitir para no bloquear tests unitarios
  }
}
