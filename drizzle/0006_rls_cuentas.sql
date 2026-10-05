-- RLS para las tablas nuevas de Fase 5 (misma politica que 0001_rls_tenants.sql / 0003_rls_business.sql).
ALTER TABLE "expenses" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "expenses" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "expenses_tenant_isolation" ON "expenses"
  USING (app_bypass_rls() OR org_id = app_current_org_id())
  WITH CHECK (app_bypass_rls() OR org_id = app_current_org_id());
--> statement-breakpoint
ALTER TABLE "cash_closures" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "cash_closures" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "cash_closures_tenant_isolation" ON "cash_closures"
  USING (app_bypass_rls() OR org_id = app_current_org_id())
  WITH CHECK (app_bypass_rls() OR org_id = app_current_org_id());
