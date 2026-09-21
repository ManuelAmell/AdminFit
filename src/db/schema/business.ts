import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { user } from "./auth-schema";
import { tenantColumns } from "./_shared";
import { branches } from "./tenants";

export const documentTypeEnum = pgEnum("document_type", ["CC", "TI", "CE", "PAS", "NIT"]);
export const memberStatusEnum = pgEnum("member_status", ["active", "inactive", "suspended"]);
export const genderEnum = pgEnum("gender", ["female", "male", "other", "unspecified"]);
export const durationTypeEnum = pgEnum("duration_type", ["days", "months"]);
export const subscriptionStatusEnum = pgEnum("subscription_status", [
  "active",
  "expired",
  "frozen",
  "cancelled",
]);
export const paymentMethodEnum = pgEnum("payment_method", ["cash", "transfer", "card", "other"]);
export const paymentStatusEnum = pgEnum("payment_status", ["completed", "voided"]);

// Socios del gimnasio ("gymMember" en permisos; "member" es el usuario del equipo en Better Auth).
export const members = pgTable(
  "members",
  {
    ...tenantColumns,
    documentType: documentTypeEnum("document_type").default("CC").notNull(),
    documentNumber: text("document_number").notNull(),
    firstName: text("first_name").notNull(),
    lastName: text("last_name").notNull(),
    email: text("email"),
    phone: text("phone"),
    birthDate: date("birth_date"),
    gender: genderEnum("gender").default("unspecified").notNull(),
    photoUrl: text("photo_url"),
    emergencyContactName: text("emergency_contact_name"),
    emergencyContactPhone: text("emergency_contact_phone"),
    notes: text("notes"),
    status: memberStatusEnum("status").default("active").notNull(),
    branchId: uuid("branch_id").references(() => branches.id, { onDelete: "set null" }),
  },
  (t) => [
    uniqueIndex("members_org_document_uidx").on(t.orgId, t.documentType, t.documentNumber),
    index("members_org_status_idx").on(t.orgId, t.status),
    index("members_org_last_name_idx").on(t.orgId, t.lastName),
  ],
);

export const plans = pgTable(
  "plans",
  {
    ...tenantColumns,
    name: text("name").notNull(),
    description: text("description"),
    priceCents: integer("price_cents").notNull(),
    durationType: durationTypeEnum("duration_type").default("months").notNull(),
    durationValue: integer("duration_value").default(1).notNull(),
    visitLimit: integer("visit_limit"),
    color: text("color").default("orange").notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    sortOrder: integer("sort_order").default(0).notNull(),
  },
  (t) => [index("plans_org_active_idx").on(t.orgId, t.isActive)],
);

export const subscriptions = pgTable(
  "subscriptions",
  {
    ...tenantColumns,
    memberId: uuid("member_id")
      .notNull()
      .references(() => members.id, { onDelete: "cascade" }),
    planId: uuid("plan_id")
      .notNull()
      .references(() => plans.id, { onDelete: "restrict" }),
    startDate: date("start_date").notNull(),
    endDate: date("end_date").notNull(),
    status: subscriptionStatusEnum("status").default("active").notNull(),
    frozenAt: date("frozen_at"),
    frozenUntil: date("frozen_until"),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    cancelReason: text("cancel_reason"),
    priceCentsSnapshot: integer("price_cents_snapshot").notNull(),
    visitLimitSnapshot: integer("visit_limit_snapshot"),
    visitsUsed: integer("visits_used").default(0).notNull(),
    notes: text("notes"),
    soldBy: text("sold_by").references(() => user.id, { onDelete: "set null" }),
  },
  (t) => [
    index("subscriptions_org_status_end_idx").on(t.orgId, t.status, t.endDate),
    index("subscriptions_member_idx").on(t.memberId),
  ],
);

export const payments = pgTable(
  "payments",
  {
    ...tenantColumns,
    memberId: uuid("member_id")
      .notNull()
      .references(() => members.id, { onDelete: "restrict" }),
    subscriptionId: uuid("subscription_id").references(() => subscriptions.id, {
      onDelete: "set null",
    }),
    amountCents: integer("amount_cents").notNull(),
    method: paymentMethodEnum("method").default("cash").notNull(),
    reference: text("reference"),
    paidAt: timestamp("paid_at", { withTimezone: true }).defaultNow().notNull(),
    receiptNumber: integer("receipt_number").notNull(),
    receivedBy: text("received_by").references(() => user.id, { onDelete: "set null" }),
    status: paymentStatusEnum("status").default("completed").notNull(),
    voidedAt: timestamp("voided_at", { withTimezone: true }),
    voidedBy: text("voided_by").references(() => user.id, { onDelete: "set null" }),
    voidReason: text("void_reason"),
    notes: text("notes"),
  },
  (t) => [
    uniqueIndex("payments_org_receipt_uidx").on(t.orgId, t.receiptNumber),
    index("payments_org_paid_at_idx").on(t.orgId, t.paidAt),
    index("payments_member_idx").on(t.memberId),
    index("payments_subscription_idx").on(t.subscriptionId),
  ],
);

export const auditLog = pgTable(
  "audit_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: text("org_id").notNull(),
    actorId: text("actor_id"),
    action: text("action").notNull(),
    entity: text("entity").notNull(),
    entityId: text("entity_id"),
    diff: jsonb("diff"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("audit_log_org_created_idx").on(t.orgId, t.createdAt)],
);

export type Member = typeof members.$inferSelect;
export type NewMember = typeof members.$inferInsert;
export type Plan = typeof plans.$inferSelect;
export type NewPlan = typeof plans.$inferInsert;
export type Subscription = typeof subscriptions.$inferSelect;
export type NewSubscription = typeof subscriptions.$inferInsert;
export type Payment = typeof payments.$inferSelect;
export type NewPayment = typeof payments.$inferInsert;
export type AuditEntry = typeof auditLog.$inferSelect;
