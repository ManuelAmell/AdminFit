import "dotenv/config";
import { expect, test } from "@playwright/test";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { cashClosures, expenses, organization, payments } from "@/db/schema";
import { addDaysISO, dayRange, todayISO } from "@/lib/dates";
import { withTenant } from "@/lib/tenant";

// Fase 6.A: Centro de caja. Se siembran 10 días de movimientos y cierres directo en DB
// (con cuadres, faltantes, sobrantes y un día sin cerrar) y se revisa que la vista los lea.
// SHOTS_DIR=<carpeta> guarda capturas en claro/oscuro/móvil para revisión visual.
const run = Date.now().toString(36);
const owner = { name: "Dueña Caja", email: `cc-${run}@test.local`, password: "Secreta123" };
const gym = { name: `Gym Centro Caja ${run}`, slug: `gym-centro-caja-${run}` }; // el slug se deriva del nombre
const shots = process.env.SHOTS_DIR;

// Diferencia del cierre por día (días atrás → centavos); null = no se cerró.
const DIFFS: Record<number, number | null> = {
  9: 0,
  8: -2_000_00,
  7: 0,
  6: 35_000_00,
  5: -60_000_00,
  4: null,
  3: 0,
  2: 500_00,
  1: 0,
};

test("centro de caja: KPIs, calendario, gráficas e historial", async ({ page }) => {
  test.setTimeout(180_000);
  await page.goto("/register");
  await page.getByLabel("Tu nombre").fill(owner.name);
  await page.getByLabel("Correo electrónico").fill(owner.email);
  await page.getByLabel("Contraseña", { exact: true }).fill(owner.password);
  await page.getByRole("button", { name: "Continuar" }).click();
  await page.getByLabel("Nombre del gimnasio").fill(gym.name);
  await page.getByLabel("Ciudad").fill("Bogotá");
  await page.getByRole("button", { name: "Crear gimnasio" }).click();
  await expect(page).toHaveURL(new RegExp(`/app/${gym.slug}/dashboard$`));

  const org = await db.query.organization.findFirst({ where: eq(organization.slug, gym.slug) });
  expect(org).toBeTruthy();
  const orgId = org!.id;
  const today = todayISO();

  await withTenant(orgId, async (tx) => {
    let receipt = 1;
    for (let back = 9; back >= 0; back--) {
      const date = addDaysISO(today, -back);
      // Mediodía del día en Bogotá.
      const at = new Date(dayRange(date).from.getTime() + 12 * 3600_000);
      const cash = (80 + back * 7) * 1_000_00;
      await tx.insert(payments).values([
        {
          orgId,
          concept: "day_pass",
          payerName: "Visitante",
          amountCents: cash,
          method: "cash",
          paidAt: at,
          receiptNumber: receipt++,
        },
        {
          orgId,
          concept: "product",
          payerName: "Cliente",
          amountCents: (40 + back * 3) * 1_000_00,
          method: back % 2 ? "transfer" : "card",
          paidAt: at,
          receiptNumber: receipt++,
        },
      ]);
      const out = back % 3 === 0 ? 12_000_00 : 0;
      if (out) {
        await tx.insert(expenses).values({
          orgId,
          category: "supplies",
          description: "Aseo",
          amountCents: out,
          method: "cash",
          spentAt: at,
        });
      }
      const diff = DIFFS[back];
      if (diff !== undefined && diff !== null) {
        const expected = 50_000_00 + cash - out;
        await tx.insert(cashClosures).values({
          orgId,
          businessDate: date,
          openingCashCents: 50_000_00,
          expectedCashCents: expected,
          countedCashCents: expected + diff,
          differenceCents: diff,
        });
      }
    }
  });

  await page.goto(`/app/${gym.slug}/cash?range=30`);
  await expect(page.getByRole("heading", { name: "Centro de caja", level: 1 })).toBeVisible();
  await expect(page.getByText("Cierres cuadrados")).toBeVisible();
  // 8 cierres, 4 cuadrados (0, 0, 0, 0 y 500 dentro de tolerancia = 5).
  await expect(page.getByText("5 de 8 cierres")).toBeVisible();
  await expect(page.getByText(/1 día quedó sin cerrar/)).toBeVisible();
  await expect(page.getByRole("grid", { name: "Calendario de cierres" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Historial de cierres" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Caja", exact: true })).toBeVisible();

  if (shots) {
    await page.waitForTimeout(1500); // animaciones de entrada y gráficas
    await page.screenshot({ path: `${shots}/cash-light.png`, fullPage: true });
    await page.emulateMedia({ colorScheme: "dark" });
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${shots}/cash-dark.png`, fullPage: true });
  }

  // "Solo descuadres" deja 3 filas: -60.000, +35.000 y -2.000.
  // Button de Base UI con nativeButton={false}: el <a> expone role="button".
  await page.getByRole("button", { name: "Solo descuadres" }).click();
  await expect(page).toHaveURL(/diff=1/);
  const historyRows = page.locator("table").last().locator("tbody tr");
  await expect(historyRows).toHaveCount(3);

  // CSV
  const res = await page.request.get(`/app/${gym.slug}/cash/export?range=30`);
  expect(res.status()).toBe(200);
  expect((await res.text()).split("\n")).toHaveLength(9); // cabecera + 8 cierres

  if (shots) {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto(`/app/${gym.slug}/cash?range=30`);
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `${shots}/cash-mobile.png`, fullPage: true });
  }
});
