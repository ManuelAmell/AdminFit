CREATE TYPE "public"."checkin_status" AS ENUM('granted', 'rejected');
--> statement-breakpoint
CREATE TABLE "checkins" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"member_id" uuid NOT NULL,
	"subscription_id" uuid,
	"branch_id" uuid,
	"status" "public"."checkin_status" DEFAULT 'granted' NOT NULL,
	"reason" text NOT NULL,
	"registered_by" text
);
--> statement-breakpoint
ALTER TABLE "checkins" ADD CONSTRAINT "checkins_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "checkins" ADD CONSTRAINT "checkins_subscription_id_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."subscriptions"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "checkins" ADD CONSTRAINT "checkins_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "checkins" ADD CONSTRAINT "checkins_registered_by_user_id_fk" FOREIGN KEY ("registered_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "checkins" ADD CONSTRAINT "checkins_org_member_fk" FOREIGN KEY ("org_id","member_id") REFERENCES "public"."members"("org_id","id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "checkins_org_created_idx" ON "checkins" USING btree ("org_id","created_at");
--> statement-breakpoint
CREATE INDEX "checkins_member_idx" ON "checkins" USING btree ("member_id");
--> statement-breakpoint
ALTER TABLE "checkins" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "checkins" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "checkins_tenant_isolation" ON "checkins"
  USING (app_bypass_rls() OR org_id = app_current_org_id())
  WITH CHECK (app_bypass_rls() OR org_id = app_current_org_id());
