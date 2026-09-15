import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const isBuildPhase =
  process.env.NEXT_PHASE === "phase-production-build" ||
  process.env.npm_lifecycle_event === "build";

const connectionString =
  process.env.DATABASE_URL ||
  (isBuildPhase ? "postgresql://build:build@localhost:5432/build" : undefined);

if (!connectionString) {
  throw new Error("DATABASE_URL no está definida. Copia .env.example a .env y configúrala.");
}

const client = postgres(connectionString, { max: 10 });

export const db = drizzle(client, { schema });
export type Database = typeof db;
