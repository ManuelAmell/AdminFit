import { index, integer, pgTable, text, uniqueIndex } from "drizzle-orm/pg-core";
import { tenantColumns } from "./_shared";

export const orgSettings = pgTable(
  "org_settings",
  {
    ...tenantColumns,
    nit: text("nit"),
    address: text("address"),
    phone: text("phone"),
    logoUrl: text("logo_url"),
    graceDays: integer("grace_days").default(3).notNull(),
    receiptPrefix: text("receipt_prefix").default("REC").notNull(),
    nextReceiptNumber: integer("next_receipt_number").default(1).notNull(),
  },
  (t) => [uniqueIndex("org_settings_org_uidx").on(t.orgId)],
);

export const branches = pgTable(
  "branches",
  {
    ...tenantColumns,
    name: text("name").notNull(),
    address: text("address"),
    phone: text("phone"),
  },
  (t) => [index("branches_org_idx").on(t.orgId)],
);

export type OrgSettings = typeof orgSettings.$inferSelect;
export type Branch = typeof branches.$inferSelect;
