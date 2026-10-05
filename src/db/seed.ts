import "dotenv/config";
import { randomUUID } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import { eq } from "drizzle-orm";
import { db } from "./index";
import {
  account,
  branches,
  cashClosures,
  expenses,
  member,
  members,
  orgSettings,
  organization,
  payments,
  plans,
  subscriptions,
  user,
} from "./schema";
import { addDaysISO, todayISO } from "@/lib/dates";
import { pesosToCents } from "@/lib/money";
import { withPlatform } from "@/lib/tenant";

// Datos de prueba fijos para desarrollo local. Re-ejecutable: borra el org/usuarios
// anteriores (por slug/email) antes de recrearlos, así "pnpm db:seed" siempre deja el
// mismo estado conocido.
const PASSWORD = "Test1234!";
const ORG_SLUG = "gimnasio-test";

const SUPERADMIN_EMAIL = "admin@adminfit.test";
const OWNER_EMAIL = "owner@gimnasiotest.test";
const OWNER2_EMAIL = "owner2@gimnasiotest.test";
const ADMIN_EMAIL = "admin.role@gimnasiotest.test";
const STAFF_EMAIL = "staff@gimnasiotest.test";

async function createUser(name: string, email: string, role?: string) {
  const id = randomUUID();
  const now = new Date();
  await db.insert(user).values({
    id,
    name,
    email,
    emailVerified: true,
    role,
    createdAt: now,
    updatedAt: now,
  });
  await db.insert(account).values({
    id: randomUUID(),
    accountId: id,
    providerId: "credential",
    userId: id,
    password: await hashPassword(PASSWORD),
    createdAt: now,
    updatedAt: now,
  });
  return id;
}

async function main() {
  console.log("Limpiando datos de un seed anterior (si existen)...");
  const existingOrg = await db.query.organization.findFirst({
    where: eq(organization.slug, ORG_SLUG),
  });
  if (existingOrg) {
    await withPlatform((tx) => tx.delete(organization).where(eq(organization.id, existingOrg.id)));
  }
  for (const email of [SUPERADMIN_EMAIL, OWNER_EMAIL, OWNER2_EMAIL, ADMIN_EMAIL, STAFF_EMAIL]) {
    await db.delete(user).where(eq(user.email, email));
  }

  console.log("Creando usuarios...");
  await createUser("Ana Superadmin", SUPERADMIN_EMAIL, "superadmin");
  const ownerId = await createUser("Carlos Dueño", OWNER_EMAIL);
  const owner2Id = await createUser("Diana Codueña", OWNER2_EMAIL);
  // Los 3 roles de org (Fase 5): admin ve todo excepto eliminar el gimnasio y la nómina.
  const adminId = await createUser("Andrés Admin", ADMIN_EMAIL);
  const staffId = await createUser("Laura Recepción", STAFF_EMAIL);

  console.log("Creando organización...");
  const orgId = randomUUID();
  const now = new Date();
  await db.insert(organization).values({
    id: orgId,
    name: "Gimnasio Test",
    slug: ORG_SLUG,
    city: "Bogotá",
    timezone: "America/Bogota",
    currency: "COP",
    status: "active",
    createdAt: now,
  });

  // El "primer" owner queda con createdAt más antiguo a propósito: prueba que
  // /admin toma el owner más antiguo cuando hay varios (ver admin/page.tsx).
  await db.insert(member).values([
    {
      id: randomUUID(),
      organizationId: orgId,
      userId: ownerId,
      role: "owner",
      createdAt: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000),
    },
    {
      id: randomUUID(),
      organizationId: orgId,
      userId: owner2Id,
      role: "owner",
      createdAt: now,
    },
    {
      id: randomUUID(),
      organizationId: orgId,
      userId: adminId,
      role: "admin",
      createdAt: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000),
    },
    {
      id: randomUUID(),
      organizationId: orgId,
      userId: staffId,
      role: "staff",
      createdAt: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000),
    },
  ]);

  console.log("Creando sedes, planes, socios, suscripciones y pagos...");
  const today = todayISO();

  await withPlatform(async (tx) => {
    await tx.insert(orgSettings).values({
      orgId,
      graceDays: 3,
      receiptPrefix: "REC",
      nextReceiptNumber: 6,
      dayPassPriceCents: pesosToCents(15_000),
    });

    const [sedePrincipal, sedeNorte] = await tx
      .insert(branches)
      .values([
        { orgId, name: "Sede Principal", address: "Cra 15 # 40-20" },
        { orgId, name: "Sede Norte", address: "Calle 140 # 12-30" },
      ])
      .returning({ id: branches.id });

    const [mensual, trimestral] = await tx
      .insert(plans)
      .values([
        {
          orgId,
          name: "Mensual",
          priceCents: pesosToCents(80_000),
          durationType: "months",
          durationValue: 1,
          color: "orange",
        },
        {
          orgId,
          name: "Trimestral",
          priceCents: pesosToCents(210_000),
          durationType: "months",
          durationValue: 3,
          color: "blue",
        },
      ])
      .returning({ id: plans.id, priceCents: plans.priceCents });

    const [maria, juan, sofia, pedro] = await tx
      .insert(members)
      .values([
        {
          orgId,
          documentType: "CC",
          documentNumber: "1001",
          firstName: "María",
          lastName: "Gómez",
          phone: "3001234567",
          branchId: sedePrincipal.id,
        },
        {
          orgId,
          documentType: "CC",
          documentNumber: "1002",
          firstName: "Juan",
          lastName: "Pérez",
          phone: "3007654321",
          branchId: sedeNorte.id,
        },
        {
          orgId,
          documentType: "CC",
          documentNumber: "1003",
          firstName: "Sofía",
          lastName: "Ramírez",
          phone: "3009876543",
          branchId: sedePrincipal.id,
        },
        {
          // Con saldo pendiente (Cartera): abona parte de la mensualidad.
          orgId,
          documentType: "CC",
          documentNumber: "1004",
          firstName: "Pedro",
          lastName: "Londoño",
          phone: "3005551234",
          branchId: sedePrincipal.id,
        },
      ])
      .returning({ id: members.id });

    const [, , , subPedro] = await tx
      .insert(subscriptions)
      .values([
        {
          // Al día: vence en 20 días.
          orgId,
          memberId: maria.id,
          planId: mensual.id,
          startDate: addDaysISO(today, -10),
          endDate: addDaysISO(today, 20),
          status: "active",
          priceCentsSnapshot: mensual.priceCents,
        },
        {
          // Por vencer: dentro de EXPIRING_SOON_DAYS (5).
          orgId,
          memberId: juan.id,
          planId: mensual.id,
          startDate: addDaysISO(today, -27),
          endDate: addDaysISO(today, 3),
          status: "active",
          priceCentsSnapshot: mensual.priceCents,
        },
        {
          // Vencida: venció hace 10 días, más allá de los graceDays (3).
          orgId,
          memberId: sofia.id,
          planId: trimestral.id,
          startDate: addDaysISO(today, -100),
          endDate: addDaysISO(today, -10),
          status: "active",
          priceCentsSnapshot: trimestral.priceCents,
        },
        {
          // Con saldo pendiente: abona 30.000 de 80.000 (Cartera).
          orgId,
          memberId: pedro.id,
          planId: mensual.id,
          startDate: addDaysISO(today, -5),
          endDate: addDaysISO(today, 25),
          status: "active",
          priceCentsSnapshot: mensual.priceCents,
        },
      ])
      .returning({ id: subscriptions.id });

    await tx.insert(payments).values([
      {
        orgId,
        memberId: maria.id,
        branchId: sedePrincipal.id,
        amountCents: pesosToCents(80_000),
        method: "cash",
        receiptNumber: 1,
        receivedBy: ownerId,
        status: "completed",
      },
      {
        orgId,
        memberId: juan.id,
        branchId: sedeNorte.id,
        amountCents: pesosToCents(80_000),
        method: "transfer",
        receiptNumber: 2,
        receivedBy: staffId,
        status: "completed",
      },
      {
        orgId,
        memberId: sofia.id,
        branchId: sedePrincipal.id,
        amountCents: pesosToCents(210_000),
        method: "card",
        receiptNumber: 3,
        receivedBy: ownerId,
        status: "completed",
      },
      {
        orgId,
        memberId: maria.id,
        branchId: sedeNorte.id,
        amountCents: pesosToCents(80_000),
        method: "cash",
        receiptNumber: 4,
        receivedBy: staffId,
        status: "voided",
        voidedAt: new Date(),
        voidedBy: staffId,
        voidReason: "Recibo duplicado",
      },
      {
        // Abono parcial: deja a Pedro en Cartera con 50.000 pendientes.
        orgId,
        memberId: pedro.id,
        subscriptionId: subPedro.id,
        branchId: sedePrincipal.id,
        concept: "membership",
        amountCents: pesosToCents(30_000),
        method: "cash",
        receiptNumber: 5,
        receivedBy: staffId,
        status: "completed",
      },
      {
        // Venta rápida sin socio (Fase 5.3): pase del día.
        orgId,
        payerName: "Visitante del día",
        branchId: sedePrincipal.id,
        concept: "day_pass",
        amountCents: pesosToCents(15_000),
        method: "cash",
        receiptNumber: 6,
        receivedBy: staffId,
        status: "completed",
      },
    ]);

    console.log("Creando gastos...");
    await tx.insert(expenses).values([
      {
        orgId,
        branchId: sedePrincipal.id,
        category: "rent",
        description: "Arriendo de septiembre",
        amountCents: pesosToCents(1_200_000),
        method: "transfer",
        spentAt: new Date(new Date(today).setDate(1)),
        recordedBy: ownerId,
      },
      {
        orgId,
        branchId: sedePrincipal.id,
        category: "utilities",
        description: "Energía y agua",
        amountCents: pesosToCents(280_000),
        method: "transfer",
        recordedBy: adminId,
      },
      {
        // Nómina: solo owner la ve (expense.readPayroll) — sirve para probar el filtro.
        orgId,
        branchId: sedePrincipal.id,
        category: "payroll",
        description: "Quincena entrenador",
        amountCents: pesosToCents(650_000),
        method: "transfer",
        recordedBy: ownerId,
      },
      {
        // Caja menor, registrada por Recepción (lo único que su rol puede crear).
        orgId,
        branchId: sedePrincipal.id,
        category: "supplies",
        description: "Papelería",
        amountCents: pesosToCents(25_000),
        method: "cash",
        recordedBy: staffId,
      },
    ]);

    console.log("Creando un cierre de caja con faltante...");
    // Ayer: cerrada con un faltante de 5.000 — para ver el aviso de diferencia sin tener
    // que hacer el arqueo a mano. Base 50.000 + nada de efectivo cobrado ayer - nada de
    // gastos = esperado 50.000; se cuentan 45.000.
    await tx.insert(cashClosures).values({
      orgId,
      branchId: sedePrincipal.id,
      businessDate: addDaysISO(today, -1),
      openingCashCents: pesosToCents(50_000),
      countedCashCents: pesosToCents(45_000),
      expectedCashCents: pesosToCents(50_000),
      differenceCents: pesosToCents(-5_000),
      notes: "Faltaron 5.000, no se encontró el motivo.",
      closedBy: staffId,
    });
  });

  console.log("\nListo. Credenciales de prueba (contraseña para todas: " + PASSWORD + "):\n");
  console.log(`  Superadmin  ${SUPERADMIN_EMAIL}   → /admin`);
  console.log(`  Owner       ${OWNER_EMAIL}   → /app/${ORG_SLUG}/dashboard`);
  console.log(`  Owner 2     ${OWNER2_EMAIL}`);
  console.log(`  Admin       ${ADMIN_EMAIL}`);
  console.log(`  Staff       ${STAFF_EMAIL}`);
  console.log(`\n  Org: Gimnasio Test (slug: ${ORG_SLUG})`);
  console.log(
    "  Pedro Londoño tiene saldo pendiente (Cartera); ayer quedó un cierre de caja con faltante.",
  );
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
