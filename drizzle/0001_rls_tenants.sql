-- Row Level Security para tablas de negocio (segunda barrera además de withTenant).
-- app.org_id lo fija withTenant(); app.bypass_rls='on' lo fija withPlatform() (superadmin/seed).
-- FORCE aplica también al owner de la tabla (el usuario de la app en Docker es owner).

CREATE OR REPLACE FUNCTION app_current_org_id() RETURNS text
  LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('app.org_id', true), '') $$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION app_bypass_rls() RETURNS boolean
  LANGUAGE sql STABLE AS $$ SELECT coalesce(current_setting('app.bypass_rls', true), '') = 'on' $$;
--> statement-breakpoint

ALTER TABLE "org_settings" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "org_settings" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "org_settings_tenant_isolation" ON "org_settings"
  USING (app_bypass_rls() OR org_id = app_current_org_id())
  WITH CHECK (app_bypass_rls() OR org_id = app_current_org_id());
--> statement-breakpoint

ALTER TABLE "branches" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "branches" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "branches_tenant_isolation" ON "branches"
  USING (app_bypass_rls() OR org_id = app_current_org_id())
  WITH CHECK (app_bypass_rls() OR org_id = app_current_org_id());
