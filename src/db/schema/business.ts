import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  foreignKey,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
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
// membership: pago ligado a una suscripción (member_id obligatorio, como hoy).
// day_pass/product/other: venta rápida sin socio — member_id null, payer_name obligatorio.
export const paymentConceptEnum = pgEnum("payment_concept", [
  "membership",
  "day_pass",
  "product",
  "other",
]);
export const expenseCategoryEnum = pgEnum("expense_category", [
  "rent",
  "utilities",
  "payroll",
  "equipment",
  "maintenance",
  "supplies",
  "other",
]);

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
    // Habilita las FK compuestas (org_id, member_id) de subscriptions/payments.
    unique("members_org_id_uidx").on(t.orgId, t.id),
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
  (t) => [
    index("plans_org_active_idx").on(t.orgId, t.isActive),
    // Habilita la FK compuesta (org_id, plan_id) de subscriptions.
    unique("plans_org_id_uidx").on(t.orgId, t.id),
  ],
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
    // FK compuestas: impiden a nivel de DB que una org referencie el socio/plan de otra.
    foreignKey({
      name: "subscriptions_org_member_fk",
      columns: [t.orgId, t.memberId],
      foreignColumns: [members.orgId, members.id],
    }).onDelete("cascade"),
    foreignKey({
      name: "subscriptions_org_plan_fk",
      columns: [t.orgId, t.planId],
      foreignColumns: [plans.orgId, plans.id],
    }).onDelete("restrict"),
  ],
);

export const payments = pgTable(
  "payments",
  {
    ...tenantColumns,
    // Nullable desde 0005: una venta rápida (pase del día, producto) no tiene socio.
    memberId: uuid("member_id").references(() => members.id, { onDelete: "restrict" }),
    subscriptionId: uuid("subscription_id").references(() => subscriptions.id, {
      onDelete: "set null",
    }),
    branchId: uuid("branch_id").references(() => branches.id, { onDelete: "set null" }),
    concept: paymentConceptEnum("concept").default("membership").notNull(),
    // Nombre de quien paga cuando no es socio (member_id null). Ver checks abajo.
    payerName: text("payer_name"),
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
    index("payments_org_status_paid_at_idx").on(t.orgId, t.status, t.paidAt),
    index("payments_member_idx").on(t.memberId),
    index("payments_subscription_idx").on(t.subscriptionId),
    foreignKey({
      name: "payments_org_member_fk",
      columns: [t.orgId, t.memberId],
      foreignColumns: [members.orgId, members.id],
    }).onDelete("restrict"),
    check(
      "payments_member_or_payer_ck",
      sql`${t.memberId} is not null or ${t.payerName} is not null`,
    ),
    check(
      "payments_membership_requires_member_ck",
      sql`${t.concept} <> 'membership' or ${t.memberId} is not null`,
    ),
  ],
);

// Gastos de caja: arriendo, servicios, nómina, etc. Reusa payment_status (completed/voided)
// para no duplicar el enum — un gasto anulado se trata igual que un pago anulado.
export const expenses = pgTable(
  "expenses",
  {
    ...tenantColumns,
    branchId: uuid("branch_id").references(() => branches.id, { onDelete: "set null" }),
    category: expenseCategoryEnum("category").notNull(),
    description: text("description").notNull(),
    amountCents: integer("amount_cents").notNull(),
    method: paymentMethodEnum("method").default("cash").notNull(),
    spentAt: timestamp("spent_at", { withTimezone: true }).defaultNow().notNull(),
    recordedBy: text("recorded_by").references(() => user.id, { onDelete: "set null" }),
    status: paymentStatusEnum("status").default("completed").notNull(),
    voidedAt: timestamp("voided_at", { withTimezone: true }),
    voidedBy: text("voided_by").references(() => user.id, { onDelete: "set null" }),
    voidReason: text("void_reason"),
    notes: text("notes"),
  },
  (t) => [
    index("expenses_org_status_spent_idx").on(t.orgId, t.status, t.spentAt),
    index("expenses_org_category_idx").on(t.orgId, t.category),
  ],
);

// Cierre de caja de un día/sede: snapshot de lo esperado (base + efectivo cobrado - gastos
// en efectivo) contra lo contado. Un día cerrado queda de solo lectura (Fase 5.6).
export const cashClosures = pgTable(
  "cash_closures",
  {
    ...tenantColumns,
    branchId: uuid("branch_id").references(() => branches.id, { onDelete: "set null" }),
    businessDate: date("business_date").notNull(),
    openingCashCents: integer("opening_cash_cents").default(0).notNull(),
    countedCashCents: integer("counted_cash_cents").notNull(),
    expectedCashCents: integer("expected_cash_cents").notNull(),
    differenceCents: integer("difference_cents").notNull(),
    notes: text("notes"),
    closedBy: text("closed_by").references(() => user.id, { onDelete: "set null" }),
    reopenedAt: timestamp("reopened_at", { withTimezone: true }),
    reopenedBy: text("reopened_by").references(() => user.id, { onDelete: "set null" }),
  },
  (t) => [
    // `branch_id` es nullable (una org sin sedes cierra "sin sede"); coalesce con un uuid
    // fijo para que el índice único cuente ese caso como una sola sede, ya que Postgres
    // trata cada NULL como distinto en un índice único normal. Parcial sobre las filas
    // vivas: reabrir es soft delete, y después se tiene que poder volver a cerrar.
    uniqueIndex("cash_closures_org_branch_date_uidx")
      .on(
        t.orgId,
        sql`coalesce(${t.branchId}, '00000000-0000-0000-0000-000000000000'::uuid)`,
        t.businessDate,
      )
      .where(sql`${t.deletedAt} is null`),
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
export type Expense = typeof expenses.$inferSelect;
export type NewExpense = typeof expenses.$inferInsert;
export type CashClosure = typeof cashClosures.$inferSelect;
export type NewCashClosure = typeof cashClosures.$inferInsert;
export type AuditEntry = typeof auditLog.$inferSelect;
