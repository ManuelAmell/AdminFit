CREATE TYPE "public"."session_status" AS ENUM('scheduled', 'in_progress', 'completed', 'cancelled');
--> statement-breakpoint
CREATE TYPE "public"."booking_status" AS ENUM('confirmed', 'attended', 'no_show', 'cancelled');
--> statement-breakpoint
CREATE TABLE "trainers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"specialty" text,
	"phone" text,
	"email" text,
	"photo_url" text,
	"bio" text,
	"is_active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "trainers_org_id_uidx" UNIQUE("org_id","id")
);
--> statement-breakpoint
CREATE TABLE "class_types" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"name" text NOT NULL,
	"description" text,
	"color" text DEFAULT '#3b82f6' NOT NULL,
	"duration_minutes" integer DEFAULT 60 NOT NULL,
	"default_capacity" integer DEFAULT 20 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "class_types_org_id_uidx" UNIQUE("org_id","id")
);
--> statement-breakpoint
CREATE TABLE "class_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"class_type_id" uuid NOT NULL,
	"trainer_id" uuid,
	"branch_id" uuid,
	"date" date NOT NULL,
	"start_time" text NOT NULL,
	"end_time" text NOT NULL,
	"capacity" integer NOT NULL,
	"status" "public"."session_status" DEFAULT 'scheduled' NOT NULL,
	"cancel_reason" text,
	CONSTRAINT "class_sessions_org_id_uidx" UNIQUE("org_id","id")
);
--> statement-breakpoint
CREATE TABLE "class_bookings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"session_id" uuid NOT NULL,
	"member_id" uuid NOT NULL,
	"status" "public"."booking_status" DEFAULT 'confirmed' NOT NULL,
	"booked_at" timestamp with time zone DEFAULT now() NOT NULL,
	"notes" text
);
--> statement-breakpoint
ALTER TABLE "trainers" ADD CONSTRAINT "trainers_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "trainers_org_active_idx" ON "trainers" USING btree ("org_id","is_active");
--> statement-breakpoint
CREATE INDEX "trainers_org_name_idx" ON "trainers" USING btree ("org_id","last_name");
--> statement-breakpoint
ALTER TABLE "class_types" ADD CONSTRAINT "class_types_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "class_types_org_active_idx" ON "class_types" USING btree ("org_id","is_active");
--> statement-breakpoint
ALTER TABLE "class_sessions" ADD CONSTRAINT "class_sessions_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "class_sessions" ADD CONSTRAINT "class_sessions_class_type_id_class_types_id_fk" FOREIGN KEY ("class_type_id") REFERENCES "public"."class_types"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "class_sessions" ADD CONSTRAINT "class_sessions_trainer_id_trainers_id_fk" FOREIGN KEY ("trainer_id") REFERENCES "public"."trainers"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "class_sessions" ADD CONSTRAINT "class_sessions_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "class_sessions" ADD CONSTRAINT "class_sessions_org_type_fk" FOREIGN KEY ("org_id","class_type_id") REFERENCES "public"."class_types"("org_id","id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "class_sessions_org_date_idx" ON "class_sessions" USING btree ("org_id","date");
--> statement-breakpoint
CREATE INDEX "class_sessions_trainer_idx" ON "class_sessions" USING btree ("trainer_id");
--> statement-breakpoint
CREATE INDEX "class_sessions_type_idx" ON "class_sessions" USING btree ("class_type_id");
--> statement-breakpoint
ALTER TABLE "class_bookings" ADD CONSTRAINT "class_bookings_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "class_bookings" ADD CONSTRAINT "class_bookings_session_id_class_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."class_sessions"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "class_bookings" ADD CONSTRAINT "class_bookings_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "class_bookings" ADD CONSTRAINT "class_bookings_org_session_fk" FOREIGN KEY ("org_id","session_id") REFERENCES "public"."class_sessions"("org_id","id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "class_bookings" ADD CONSTRAINT "class_bookings_org_member_fk" FOREIGN KEY ("org_id","member_id") REFERENCES "public"."members"("org_id","id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "class_bookings_session_member_uidx" ON "class_bookings" USING btree ("session_id","member_id");
--> statement-breakpoint
CREATE INDEX "class_bookings_org_session_idx" ON "class_bookings" USING btree ("org_id","session_id");
--> statement-breakpoint
CREATE INDEX "class_bookings_member_idx" ON "class_bookings" USING btree ("member_id");
--> statement-breakpoint
ALTER TABLE "trainers" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "trainers" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "trainers_tenant_isolation" ON "trainers"
  USING (app_bypass_rls() OR org_id = app_current_org_id())
  WITH CHECK (app_bypass_rls() OR org_id = app_current_org_id());
--> statement-breakpoint
ALTER TABLE "class_types" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "class_types" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "class_types_tenant_isolation" ON "class_types"
  USING (app_bypass_rls() OR org_id = app_current_org_id())
  WITH CHECK (app_bypass_rls() OR org_id = app_current_org_id());
--> statement-breakpoint
ALTER TABLE "class_sessions" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "class_sessions" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "class_sessions_tenant_isolation" ON "class_sessions"
  USING (app_bypass_rls() OR org_id = app_current_org_id())
  WITH CHECK (app_bypass_rls() OR org_id = app_current_org_id());
--> statement-breakpoint
ALTER TABLE "class_bookings" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "class_bookings" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "class_bookings_tenant_isolation" ON "class_bookings"
  USING (app_bypass_rls() OR org_id = app_current_org_id())
  WITH CHECK (app_bypass_rls() OR org_id = app_current_org_id());
