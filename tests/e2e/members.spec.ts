import { expect, test } from "@playwright/test";

const run = Date.now().toString(36);
const owner = { name: "Sofía Owner", email: `sofia-${run}@test.local`, password: "Secreta123" };
const gym = { name: `Gym Socios ${run}`, slug: `gym-socios-${run}` };

test.describe.serial("socios", () => {
  test("registra gym, crea un socio, lo busca y abre la ficha", async ({ page }) => {
    await page.goto("/register");
    await page.getByLabel("Tu nombre").fill(owner.name);
    await page.getByLabel("Correo electrónico").fill(owner.email);
    await page.getByLabel("Contraseña", { exact: true }).fill(owner.password);
    await page.getByRole("button", { name: "Continuar" }).click();
    await page.getByLabel("Nombre del gimnasio").fill(gym.name);
    await page.getByLabel("Ciudad").fill("Medellín");
    await page.getByRole("button", { name: "Crear gimnasio" }).click();
    await expect(page).toHaveURL(new RegExp(`/app/${gym.slug}/dashboard$`));

    await page.goto(`/app/${gym.slug}/members`);
    await expect(page.getByRole("heading", { level: 1, name: "Socios" })).toBeVisible();
    await expect(page.getByText("Aún no hay socios")).toBeVisible();

    await page.getByRole("button", { name: "Nuevo socio" }).first().click();
    await expect(page).toHaveURL(new RegExp(`/members/new$`));

    // Validación inline antes de enviar.
    await page.getByRole("button", { name: "Registrar socio" }).click();
    await expect(page.getByText("Ingresa el nombre")).toBeVisible();

    await page.getByLabel("Número de documento").fill(`9${run.slice(-6)}`);
    await page.getByLabel("Nombres").fill("Valentina");
    await page.getByLabel("Apellidos").fill("Restrepo");
    await page.getByLabel("Teléfono", { exact: true }).fill("3115557788");
    await page.getByRole("button", { name: "Registrar socio" }).click();

    await expect(page).toHaveURL(/\/members\/[0-9a-f-]{36}$/);
    await expect(page.getByRole("heading", { level: 1, name: "Valentina Restrepo" })).toBeVisible();
    await expect(page.getByText("Sin membresía").first()).toBeVisible();

    // Documento duplicado → error en el campo.
    await page.goto(`/app/${gym.slug}/members/new`);
    await page.getByLabel("Número de documento").fill(`9${run.slice(-6)}`);
    await page.getByLabel("Nombres").fill("Otra");
    await page.getByLabel("Apellidos").fill("Persona");
    await page.getByRole("button", { name: "Registrar socio" }).click();
    await expect(page.getByText("Ya existe un socio con este documento.")).toBeVisible();

    // Búsqueda.
    await page.goto(`/app/${gym.slug}/members`);
    await page.getByRole("searchbox", { name: "Buscar socios" }).fill("restre");
    await expect(page).toHaveURL(/q=restre/);
    await expect(page.getByRole("link", { name: "Valentina Restrepo" })).toBeVisible();
    await page.getByRole("searchbox", { name: "Buscar socios" }).fill("nadie");
    await expect(page.getByText("No encontramos socios con esos filtros.")).toBeVisible();
    await page.getByRole("button", { name: "Limpiar filtros" }).click();
    await page.getByRole("link", { name: "Valentina Restrepo" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Valentina Restrepo" })).toBeVisible();
  });
});
