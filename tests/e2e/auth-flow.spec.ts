import { expect, test, type Page } from "@playwright/test";

const run = Date.now().toString(36);
const owner = { name: "Laura Owner", email: `laura-${run}@test.local`, password: "Secreta123" };
const staff = { name: "Pedro Staff", email: `pedro-${run}@test.local`, password: "Secreta123" };
const gym = { name: `Gym Fuerza ${run}`, slug: `gym-fuerza-${run}`, city: "Bogotá" };

async function register(page: Page, user: typeof owner) {
  await page.goto("/register");
  await page.getByLabel("Tu nombre").fill(user.name);
  await page.getByLabel("Correo electrónico").fill(user.email);
  await page.getByLabel("Contraseña", { exact: true }).fill(user.password);
  await page.getByRole("button", { name: "Continuar" }).click();
}

test.describe.serial("registro, equipo e invitación", () => {
  test("owner registra su gym y llega al dashboard", async ({ page }) => {
    await register(page, owner);
    await expect(page.getByRole("heading", { name: "Registra tu gimnasio" })).toBeVisible();
    await page.getByLabel("Nombre del gimnasio").fill(gym.name);
    await expect(page.getByLabel("Identificador (URL)")).toHaveValue(gym.slug);
    await page.getByLabel("Ciudad").fill(gym.city);
    await page.getByRole("button", { name: "Crear gimnasio" }).click();

    await expect(page).toHaveURL(new RegExp(`/app/${gym.slug}/dashboard$`));
    await expect(page.getByRole("heading", { level: 1, name: "Dashboard" })).toBeVisible();
    await expect(page.getByText(gym.name).first()).toBeVisible();
  });

  test("owner invita a recepción y el invitado acepta", async ({ browser, page }) => {
    // login owner
    await page.goto("/login");
    await page.getByLabel("Correo electrónico").fill(owner.email);
    await page.getByLabel("Contraseña", { exact: true }).fill(owner.password);
    await page.getByRole("button", { name: "Ingresar" }).click();
    await expect(page).toHaveURL(new RegExp(`/app/${gym.slug}/dashboard$`));

    await page.goto(`/app/${gym.slug}/settings/team`);
    await page.getByLabel("Correo electrónico").fill(staff.email);
    await page.getByRole("button", { name: "Crear invitación" }).click();
    await expect(page.getByText(`Invitación creada para ${staff.email}`)).toBeVisible();

    const inviteRow = page.getByRole("row", { name: new RegExp(staff.email) });
    await expect(inviteRow).toBeVisible();
    const invitationId = await inviteRow.getAttribute("data-invitation-id");
    expect(invitationId).toBeTruthy();

    // El invitado se registra con el mismo correo y abre la invitación.
    const ctx = await browser.newContext();
    const staffPage = await ctx.newPage();
    // Sin sesión, /invite manda a /login?next=...; desde ahí se registra sin crear gimnasio.
    await staffPage.goto(`/invite/${invitationId}`);
    await expect(staffPage).toHaveURL(/\/login\?next=/);
    await staffPage.getByRole("link", { name: "Crea una cuenta" }).click();
    await expect(staffPage).toHaveURL(/\/register\?next=/);
    await staffPage.getByLabel("Tu nombre").fill(staff.name);
    await staffPage.getByLabel("Correo electrónico").fill(staff.email);
    await staffPage.getByLabel("Contraseña", { exact: true }).fill(staff.password);
    await staffPage.getByRole("button", { name: "Crear cuenta" }).click();
    await expect(staffPage).toHaveURL(new RegExp(`/invite/${invitationId}$`));
    await expect(staffPage.getByRole("heading", { name: `Únete a ${gym.name}` })).toBeVisible();
    await staffPage.getByRole("button", { name: "Aceptar invitación" }).click();
    await expect(staffPage).toHaveURL(new RegExp(`/app/${gym.slug}/dashboard$`));

    // Recepción no ve el formulario de invitación.
    await staffPage.goto(`/app/${gym.slug}/settings/team`);
    await expect(staffPage.getByRole("heading", { name: "Miembros" })).toBeVisible();
    await expect(staffPage.getByRole("button", { name: "Crear invitación" })).toHaveCount(0);
    await ctx.close();
  });

  test("un usuario ajeno no puede abrir el gym por URL", async ({ browser }) => {
    const ctx = await browser.newContext();
    const other = await ctx.newPage();
    await register(other, {
      name: "Ana Otra",
      email: `ana-${run}@test.local`,
      password: "Secreta123",
    });
    await other.getByLabel("Nombre del gimnasio").fill(`Gym Ana ${run}`);
    await other.getByLabel("Ciudad").fill("Cali");
    await other.getByRole("button", { name: "Crear gimnasio" }).click();
    await expect(other).toHaveURL(new RegExp(`/app/gym-ana-${run}/dashboard$`));
    await other.goto(`/app/${gym.slug}/dashboard`);
    await expect(other.getByText(/404|not found|no se encontr/i).first()).toBeVisible();
    await ctx.close();
  });
});
