import {
  boolean,
  date,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { organization, user } from "./auth-schema";

// --- Enums ---

export const tenantSubStatusEnum = pgEnum("tenant_sub_status", ["trial", "active", "expired"]);

export const bankAccountTypeEnum = pgEnum("bank_account_type", ["ahorros", "corriente"]);

// --- Tablas ---

// Planes SaaS que el superadmin define para cobrar a los gimnasios.
// Tablas de plataforma: sin tenantColumns, sin RLS. Acceso protegido por requireSuperadmin().
export const platformPlans = pgTable("platform_plans", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  description: text("description"),
  priceCents: integer("price_cents").notNull(), // COP centavos/mes
  maxMembers: integer("max_members"), // null = ilimitado
  maxBranches: integer("max_branches"), // null = ilimitado
  maxStaff: integer("max_staff"), // null = ilimitado
  isActive: boolean("is_active").default(true).notNull(),
  sortOrder: integer("sort_order").default(0).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

// Historial de suscripciones SaaS de cada gimnasio. Cada renovación = nueva fila.
// La suscripción "vigente" es la más reciente por org_id.
export const tenantSubscriptions = pgTable(
  "tenant_subscriptions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: text("org_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    planId: uuid("plan_id").references(() => platformPlans.id, { onDelete: "set null" }),
    status: tenantSubStatusEnum("status").default("trial").notNull(),
    startDate: date("start_date").notNull(),
    endDate: date("end_date").notNull(),
    priceCentsSnapshot: integer("price_cents_snapshot").notNull(),
    notes: text("notes"),
    assignedBy: text("assigned_by").references(() => user.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("tenant_subs_org_idx").on(t.orgId),
    index("tenant_subs_org_status_idx").on(t.orgId, t.status),
  ],
);

// Configuración global de la plataforma (singleton). Datos bancarios para que
// los dueños de gym sepan dónde pagar.
export const platformSettings = pgTable("platform_settings", {
  id: uuid("id").primaryKey().defaultRandom(),
  bankHolderName: text("bank_holder_name"),
  bankName: text("bank_name"),
  bankAccountType: bankAccountTypeEnum("bank_account_type"),
  bankAccountNumber: text("bank_account_number"),
  nequiNumber: text("nequi_number"),
  additionalInfo: text("additional_info"),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

// --- Relations ---

export const platformPlansRelations = relations(platformPlans, ({ many }) => ({
  subscriptions: many(tenantSubscriptions),
}));

export const tenantSubscriptionsRelations = relations(tenantSubscriptions, ({ one }) => ({
  organization: one(organization, {
    fields: [tenantSubscriptions.orgId],
    references: [organization.id],
  }),
  plan: one(platformPlans, {
    fields: [tenantSubscriptions.planId],
    references: [platformPlans.id],
  }),
  assignedByUser: one(user, {
    fields: [tenantSubscriptions.assignedBy],
    references: [user.id],
  }),
}));

// --- Types ---

export type PlatformPlan = typeof platformPlans.$inferSelect;
export type NewPlatformPlan = typeof platformPlans.$inferInsert;
export type TenantSubscription = typeof tenantSubscriptions.$inferSelect;
export type NewTenantSubscription = typeof tenantSubscriptions.$inferInsert;
export type PlatformSettingsRow = typeof platformSettings.$inferSelect;
