import { defineConfig } from "drizzle-kit";

// `generate` solo introspecciona el schema; `migrate`/`push`/`studio` sí necesitan DATABASE_URL real.
const databaseUrl =
  process.env.DATABASE_URL ?? "postgresql://placeholder:placeholder@localhost:5432/placeholder";

export default defineConfig({
  schema: "./src/db/schema/index.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: { url: databaseUrl },
  strict: true,
  verbose: true,
});
