import "dotenv/config";
import { expect, test } from "@playwright/test";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { members, organization, plans, subscriptions } from "@/db/schema";
import { withTenant } from "@/lib/tenant";

const run = Date.now().toString(36);
const owner = { name: "Caja Owner", email: `caja-${run}@test.local`, password: "Secreta123" };
const gym = { name: `Gym Caja ${run}`, slug: `gym-caja-${run}` };

test.describe.serial("pagos: registrar, recibo, anular", () => {
  test("flujo completo", async ({ page }) => {
    test.setTimeout(180_000);
    // Registro del gym.
    await page.goto("/register");
    await page.getByLabel("Tu nombre").fill(owner.name);
    await page.getByLabel("Correo electrónico").fill(owner.email);
    await page.getByLabel("Contraseña", { exact: true }).fill(owner.password);
    await page.getByRole("button", { name: "Continuar" }).click();
    await page.getByLabel("Nombre del gimnasio").fill(gym.name);
    await page.getByLabel("Ciudad").fill("Medellín");
    await page.getByRole("button", { name: "Crear gimnasio" }).click();
    await expect(page).toHaveURL(new RegExp(`/app/${gym.slug}/dashboard$`));

    // Socio + plan + membresía directo en DB (los módulos de socios/planes son de otros agentes).
    const org = await db.query.organization.findFirst({ where: eq(organization.slug, gym.slug) });
    expect(org).toBeTruthy();
    await withTenant(org!.id, async (tx) => {
      const [m] = await tx
        .insert(members)
        .values({
          orgId: org!.id,
          documentNumber: `9${run}`,
          firstName: "Sofía",
          lastName: "Rueda",
        })
        .returning({ id: members.id });
      const [p] = await tx
        .insert(plans)
        .values({ orgId: org!.id, name: "Mensual", priceCents: 120_000_00 })
        .returning({ id: plans.id });
      await tx.insert(subscriptions).values({
        orgId: org!.id,
        memberId: m.id,
        planId: p.id,
        startDate: "2026-09-01",
        endDate: "2026-10-01",
        priceCentsSnapshot: 120_000_00,
      });
    });

    // Registrar pago con el picker.
    await page.goto(`/app/${gym.slug}/payments/new`);
    await page.getByLabel("Socio").fill("Sof");
    await page.getByRole("option", { name: /Sofía Rueda/ }).click();
    await expect(page.getByText("Saldo:")).toBeVisible();
    await expect(page.getByLabel("Monto (COP)")).toHaveValue("120.000");
    await page.getByLabel("Monto (COP)").fill("50000");
    await expect(page.getByText("Quedará un saldo pendiente de $ 70.000.")).toBeVisible();
    await page.getByRole("button", { name: /Registrar pago/ }).click();

    await expect(page).toHaveURL(new RegExp(`/app/${gym.slug}/payments/[0-9a-f-]{36}$`));
    await expect(page.getByRole("heading", { level: 1, name: "Recibo REC-000001" })).toBeVisible();
    await expect(page.getByText("$ 50.000").first()).toBeVisible();

    // Recibo imprimible.
    await page.getByRole("button", { name: "Recibo", exact: true }).click();
    await expect(page).toHaveURL(/\/receipt$/);
    await expect(page.getByText("Cincuenta mil pesos", { exact: false })).toBeVisible();
    await expect(page.getByText("Saldo pendiente")).toBeVisible();
    await page.emulateMedia({ media: "print" });
    await expect(page.getByRole("button", { name: "Imprimir" })).toBeHidden();
    await expect(page.getByLabel("Recibo de pago REC-000001")).toBeVisible();
    await page.emulateMedia({ media: "screen" });

    // Lista con totales del día.
    await page.goto(`/app/${gym.slug}/payments`);
    await expect(page.getByText("Total cobrado")).toBeVisible();
    await expect(page.getByRole("row", { name: /Sofía Rueda/ })).toBeVisible();

    // Anular.
    await page.getByRole("link", { name: "#000001" }).click();
    await page.getByRole("button", { name: "Anular pago" }).click();
    await page.getByLabel("Motivo").fill("Pago duplicado en prueba");
    await page.getByRole("dialog").getByRole("button", { name: "Anular pago" }).click();
    await expect(page.getByText("Pago anulado")).toBeVisible();
    await expect(page.getByRole("button", { name: "Anular pago" })).toHaveCount(0);

    // Cierre de caja refleja el anulado.
    await page.goto(`/app/${gym.slug}/payments/cash-close`);
    await expect(page.getByRole("heading", { name: "Anulados" })).toBeVisible();
    await expect(page.getByText("$ 0").first()).toBeVisible();
  });
});
