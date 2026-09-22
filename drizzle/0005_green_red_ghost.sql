CREATE TYPE "public"."expense_category" AS ENUM('rent', 'utilities', 'payroll', 'equipment', 'maintenance', 'supplies', 'other');--> statement-breakpoint
CREATE TYPE "public"."payment_concept" AS ENUM('membership', 'day_pass', 'product', 'other');--> statement-breakpoint
CREATE TABLE "cash_closures" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"branch_id" uuid,
	"business_date" date NOT NULL,
	"opening_cash_cents" integer DEFAULT 0 NOT NULL,
	"counted_cash_cents" integer NOT NULL,
	"expected_cash_cents" integer NOT NULL,
	"difference_cents" integer NOT NULL,
	"notes" text,
	"closed_by" text,
	"reopened_at" timestamp with time zone,
	"reopened_by" text
);
--> statement-breakpoint
CREATE TABLE "expenses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"branch_id" uuid,
	"category" "expense_category" NOT NULL,
	"description" text NOT NULL,
	"amount_cents" integer NOT NULL,
	"method" "payment_method" DEFAULT 'cash' NOT NULL,
	"spent_at" timestamp with time zone DEFAULT now() NOT NULL,
	"recorded_by" text,
	"status" "payment_status" DEFAULT 'completed' NOT NULL,
	"voided_at" timestamp with time zone,
	"voided_by" text,
	"void_reason" text
);
--> statement-breakpoint
ALTER TABLE "payments" ALTER COLUMN "member_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "org_settings" ADD COLUMN "day_pass_price_cents" integer;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "concept" "payment_concept" DEFAULT 'membership' NOT NULL;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "payer_name" text;--> statement-breakpoint
ALTER TABLE "cash_closures" ADD CONSTRAINT "cash_closures_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cash_closures" ADD CONSTRAINT "cash_closures_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cash_closures" ADD CONSTRAINT "cash_closures_closed_by_user_id_fk" FOREIGN KEY ("closed_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cash_closures" ADD CONSTRAINT "cash_closures_reopened_by_user_id_fk" FOREIGN KEY ("reopened_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_recorded_by_user_id_fk" FOREIGN KEY ("recorded_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_voided_by_user_id_fk" FOREIGN KEY ("voided_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "cash_closures_org_branch_date_uidx" ON "cash_closures" USING btree ("org_id",coalesce("branch_id", '00000000-0000-0000-0000-000000000000'::uuid),"business_date");--> statement-breakpoint
CREATE INDEX "expenses_org_status_spent_idx" ON "expenses" USING btree ("org_id","status","spent_at");--> statement-breakpoint
CREATE INDEX "expenses_org_category_idx" ON "expenses" USING btree ("org_id","category");--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_member_or_payer_ck" CHECK ("payments"."member_id" is not null or "payments"."payer_name" is not null);--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_membership_requires_member_ck" CHECK ("payments"."concept" <> 'membership' or "payments"."member_id" is not null);