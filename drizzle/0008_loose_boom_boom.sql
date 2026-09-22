CREATE TYPE "public"."bank_account_type" AS ENUM('ahorros', 'corriente');--> statement-breakpoint
CREATE TYPE "public"."tenant_sub_status" AS ENUM('trial', 'active', 'expired');--> statement-breakpoint
CREATE TABLE "platform_plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"price_cents" integer NOT NULL,
	"max_members" integer,
	"max_branches" integer,
	"max_staff" integer,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "platform_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"bank_holder_name" text,
	"bank_name" text,
	"bank_account_type" "bank_account_type",
	"bank_account_number" text,
	"nequi_number" text,
	"additional_info" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tenant_subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" text NOT NULL,
	"plan_id" uuid,
	"status" "tenant_sub_status" DEFAULT 'trial' NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"price_cents_snapshot" integer NOT NULL,
	"notes" text,
	"assigned_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "tenant_subscriptions" ADD CONSTRAINT "tenant_subscriptions_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_subscriptions" ADD CONSTRAINT "tenant_subscriptions_plan_id_platform_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."platform_plans"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_subscriptions" ADD CONSTRAINT "tenant_subscriptions_assigned_by_user_id_fk" FOREIGN KEY ("assigned_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "tenant_subs_org_idx" ON "tenant_subscriptions" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "tenant_subs_org_status_idx" ON "tenant_subscriptions" USING btree ("org_id","status");