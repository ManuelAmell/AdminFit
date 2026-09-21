ALTER TABLE "payments" ADD COLUMN "branch_id" uuid;--> statement-breakpoint
ALTER TABLE "members" ADD CONSTRAINT "members_org_id_uidx" UNIQUE("org_id","id");--> statement-breakpoint
ALTER TABLE "plans" ADD CONSTRAINT "plans_org_id_uidx" UNIQUE("org_id","id");--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_org_member_fk" FOREIGN KEY ("org_id","member_id") REFERENCES "public"."members"("org_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_org_member_fk" FOREIGN KEY ("org_id","member_id") REFERENCES "public"."members"("org_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_org_plan_fk" FOREIGN KEY ("org_id","plan_id") REFERENCES "public"."plans"("org_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "payments_org_status_paid_at_idx" ON "payments" USING btree ("org_id","status","paid_at");
