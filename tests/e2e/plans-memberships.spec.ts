import "dotenv/config";
import { expect, test } from "@playwright/test";
import postgres from "postgres";

const run = Date.now().toString(36);
const owner = { name: "Sofía Dueña", email: `sofia-${run}@test.local`, password: "Secreta123" };
const gym = { name: `Gym Planes ${run}`, slug: `gym-planes-${run}`, city: "Medellín" };
const member = { doc: `9${run}`, first: "Carlos", last: "Socio" };

test.describe.serial("planes y membresías", () => {
  // Primer arranque de Turbopack: cada ruta nueva compila en frío (10 s+).
  test.setTimeout(180_000);

  test("owner crea plan, socio (por DB) y vende una membresía", async ({ page }) => {
    // Registro del gym
    await page.goto("/register");
    await page.getByLabel("Tu nombre").fill(owner.name);
    await page.getByLabel("Correo electrónico").fill(owner.email);
    await page.getByLabel("Contraseña", { exact: true }).fill(owner.password);
    await page.getByRole("button", { name: "Continuar" }).click();
    await page.getByLabel("Nombre del gimnasio").fill(gym.name);
    await page.getByLabel("Ciudad").fill(gym.city);
    await page.getByRole("button", { name: "Crear gimnasio" }).click();
    await expect(page).toHaveURL(new RegExp(`/app/${gym.slug}/dashboard$`), { timeout: 60_000 });

    // Plan
    await page.goto(`/app/${gym.slug}/plans`);
    await page.getByRole("button", { name: "Nuevo plan" }).first().click();
    await page.getByLabel("Nombre").fill("Mensual");
    await page.getByLabel("Precio (COP)").fill("120.000");
    await expect(page.getByText("$ 120.000")).toBeVisible();
    await page.getByRole("button", { name: "Crear plan" }).click();
    await expect(page.getByText("Plan creado.")).toBeVisible();
    const row = page.getByRole("row", { name: /Mensual/ });
    await expect(row).toBeVisible();
    await expect(row.getByText("1 mes")).toBeVisible();
    await expect(row.getByText("$ 120.000")).toBeVisible();

    // Socio por DB (el módulo de socios lo construye otro agente)
    const sql = postgres(process.env.DATABASE_URL!, { max: 1 });
    const [{ id: orgId }] = await sql<
      { id: string }[]
    >`select id from organization where slug = ${gym.slug}`;
    await sql`select set_config('app.bypass_rls', 'on', false)`;
    await sql`insert into members (org_id, document_number, first_name, last_name)
              values (${orgId}, ${member.doc}, ${member.first}, ${member.last})`;
    await sql.end();

    // Vender
    await page.goto(`/app/${gym.slug}/memberships`);
    await page.getByRole("button", { name: "Vender membresía" }).click();
    await expect(page).toHaveURL(new RegExp(`/memberships/new$`), { timeout: 60_000 });
    await page.getByRole("combobox", { name: /socio/i }).fill("carl");
    await page.getByRole("option", { name: /Carlos Socio/ }).click();
    await expect(page.getByRole("button", { name: "Cambiar socio" })).toBeVisible();
    await page.getByLabel("Fecha de inicio").fill("2026-01-31");
    await expect(page.getByTestId("sell-end-date")).toHaveText(/28 feb 2026/);
    await page.getByRole("button", { name: "Vender membresía" }).click();

    await expect(page).toHaveURL(new RegExp(`/app/${gym.slug}/memberships$`), { timeout: 60_000 });
    const subRow = page.getByRole("row", { name: /Carlos Socio/ });
    await expect(subRow).toBeVisible();
    await expect(subRow.getByText("Mensual")).toBeVisible();
    await expect(subRow.getByText("$ 120.000")).toBeVisible();
    await expect(subRow.getByText(/Vencida|En gracia/)).toBeVisible();

    // Renovar desde la fila: empieza hoy (la anterior venció) y queda activa
    await subRow.getByRole("button", { name: /Acciones para Carlos Socio/ }).click();
    await page.getByRole("menuitem", { name: "Renovar" }).click();
    await page.getByRole("button", { name: "Renovar", exact: true }).click();
    await expect(page.getByText(/Renovada:/)).toBeVisible();
    await expect(
      page
        .getByRole("row", { name: /Carlos Socio/ })
        .first()
        .getByText("Al día"),
    ).toBeVisible();

    // Filtro "Activas" muestra 1
    await page.getByRole("link", { name: /^Activas/ }).click();
    await expect(page.getByRole("row", { name: /Carlos Socio/ })).toHaveCount(1);
  });
});
