import { text, timestamp, uuid } from "drizzle-orm/pg-core";
import { organization } from "./auth-schema";

// Columnas comunes a toda tabla de negocio (multi-tenant + soft delete).
export const tenantColumns = {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: text("org_id")
    .notNull()
    .references(() => organization.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
};
