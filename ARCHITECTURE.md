# AdminFit — Arquitectura

SaaS multi-tenant para gestión de gimnasios en Colombia: socios,
membresías, pagos manuales, caja, gastos, reportes y cobro del SaaS a
cada gimnasio. Diseño visual y de UI en [DESIGN.md](./DESIGN.md);
convenciones de código en [AGENTS.md](./AGENTS.md); backlog en
[PENDIENTES.md](./PENDIENTES.md).

> **¿Vas a contribuir (tú o tu IA)?** Lee primero
> [Flujo de trabajo](#flujo-de-trabajo-gitflow) y
> [Checklist antes de abrir PR](#checklist-antes-de-abrir-pr). Si usas un
> asistente de IA, dale este archivo, `DESIGN.md`, `AGENTS.md` y
> `PENDIENTES.md` como contexto antes de pedirle código.

## Stack

| Capa             | Elección                                                                  | Notas                                                                |
| ---------------- | ------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| Framework        | **Next.js 16** (App Router, Turbopack) + TypeScript + **pnpm**            | `proxy.ts` (no `middleware.ts`); `params`/`cookies()` son promesas.  |
| UI               | Tailwind v4 + **shadcn/ui preset Nova sobre Base UI** (no Radix) + lucide | Ver [DESIGN.md](./DESIGN.md). Tablas con TanStack Table.             |
| Animación        | Smooth UI (`src/components/smoothui/`) + `motion`                         | Solo animación; el resto de componentes van en `src/components/ui/`. |
| Gráficas         | `recharts` vía `src/components/ui/chart.tsx`                              | Paleta `--chart-1..8`.                                               |
| DB               | **PostgreSQL 16 + Drizzle ORM** + Row Level Security                      | Migraciones versionadas en `drizzle/`.                               |
| Auth             | **Better Auth** + plugins `organization` y `admin`                        | Orgs, roles, invitaciones, superadmin.                               |
| Forms/validación | react-hook-form + **Zod 4**                                               | Mismo schema en cliente, Server Action y seed.                       |
| Dinero           | `integer` en **centavos** + `Intl.NumberFormat('es-CO', COP)`             | Nunca floats. Helpers en `src/lib/money.ts`.                         |
| Fechas           | `date-fns` + `@date-fns/tz`, TZ **`America/Bogota`**                      | Helpers en `src/lib/dates.ts` (`todayISO`, `computeEndDate`…).       |
| Tests            | Vitest (unit + integration contra Postgres real) + Playwright (e2e)       |                                                                      |
| Infra            | Postgres local (Docker Compose o `pnpm db:local`), self-host              |                                                                      |

## Flujo de trabajo (GitFlow)

Detalle de comandos en [README.md](./README.md#flujo-de-ramas-gitflow).

- **`main`**: siempre desplegable. Solo recibe merges de `release/*` o
  `hotfix/*`. **Nunca** se ramifica una feature desde `main` ni se abre un PR
  de feature contra `main`.
- **`develop`**: rama de integración. **Toda `feature/*` sale de `develop`
  y vuelve a `develop` por PR.**
- **`feature/<modulo>`**: una por módulo o fase. Antes de empezar y antes
  de abrir el PR: `git fetch && git rebase origin/develop`.
- **`release/<version>`** / **`hotfix/<nombre>`**: como en GitFlow estándar
  (merge a `main` y `develop` + tag).
- Commits en **Conventional Commits** (`feat:`, `fix:`, `chore:`, `test:`,
  `docs:`), en español, un cambio lógico por commit.

### Checklist antes de abrir PR

1. Rama creada desde `develop` actualizado (no desde `main`).
2. **Migraciones**: nunca escritas a mano con número inventado.
   - Cambia el schema en `src/db/schema/*.ts` → `pnpm db:generate` (genera
     el `.sql` **y** su `meta/NNNN_snapshot.json`; sin snapshot, el próximo
     `generate` vuelve a crear las tablas).
   - El RLS de tablas nuevas va en una migración aparte
     `NNNN_rls_<modulo>.sql` con el mismo patrón que
     `drizzle/0006_rls_cuentas.sql` (`ENABLE` + `FORCE` + policy
     `<tabla>_tenant_isolation`).
   - Si `develop` ya tiene una migración con tu número, **rebasea y
     regenera**: no renombres a mano ni edites migraciones ya mergeadas.
   - Avisa en el PR que trae migraciones, porque dos ramas con migraciones
     siempre chocan en `drizzle/meta/_journal.json`.
3. Cada tabla de negocio nueva: `...tenantColumns`, FK compuesta
   `(org_id, x_id)` hacia otras tablas del tenant, RLS, y agregarla a
   `tests/integration/tenant-isolation.test.ts`.
4. Revisa en `PENDIENTES.md` que nadie lo tenga en curso y que el módulo no exista ya (`src/modules/`, `src/app/app/[orgSlug]/`)
   antes de crearlo; extiende en vez de duplicar.
5. Permisos nuevos en `src/lib/auth/permissions.ts` respetando la matriz
   (recepción/`staff` no toca configuración ni ve cifras sensibles). Las
   páginas comprueban permiso con `can(...)` y no solo con `requireOrg`.
6. Contadores y cupos (aforo, visitas, consecutivos) se protegen contra
   concurrencia con `SELECT … FOR UPDATE` o un `UPDATE … WHERE` atómico
   dentro de `withTenant`.
7. No metas binarios ni base64 grandes en columnas de la DB sin
   coordinarlo antes (fotos, PDFs).
8. **No debilites los tests para que pasen.** `tests/integration/setup.ts`
   debe fallar si no hay DB o si una migración falla.
9. `pnpm verify` en verde con Postgres levantado, y
   `pnpm db:generate` sin cambios pendientes (no debe aparecer ningún
   `.sql` nuevo).

## Multi-tenancy

**Base de datos compartida, esquema compartido, columna `org_id` en toda
tabla de negocio, más Row Level Security de Postgres como segunda barrera.**

- Better Auth gestiona `organization`, `member`, `invitation` y la
  "active organization" en sesión.
- Cada request de servidor obtiene `orgId` de la sesión y lo pasa a
  `withTenant(orgId, fn)` (`src/lib/tenant.ts`). Este helper fija `app.org_id`
  dentro de una transacción, y las policies RLS filtran por ese valor.
  Ninguna query de negocio corre fuera de `withTenant`.
- Roles por org (`member.role`): `owner`, `admin`, `staff` (recepción).
  Los permisos se declaran en `src/lib/auth/permissions.ts`, compartido
  entre server y cliente. El rol de plataforma (`user.role`) es
  `user` | `superadmin`: superadmin ve `/admin` y puede abrir cualquier gym.
- **Info sensible por rol, no solo por UI:** `finance.read`,
  `payment.readAll`/`cashClosure.readAll` y `expense.readPayroll`.
  Recepción no tiene ninguno. Sus queries reciben un `scope`
  (`recordedBy`, `excludePayroll`) que filtra en el WHERE. `can(ctx, permisos)`
  sirve igual en Server Components, Client Components y Server Actions.
- **La conexión a Postgres debe usar un rol no superusuario**
  (`adminfit_app`), porque RLS se ignora para superusuarios. Ver
  `docker/postgres-init.sql` y `scripts/pg-local.mjs`.
- Invitaciones: en v1 no hay email transaccional. El owner/admin copia el
  enlace `/invite/[id]` desde Configuración → Equipo.

### Patrón de módulo

`src/modules/<x>/`:

- `schema.ts`: schemas Zod.
- `queries.ts`: lecturas, siempre con `withTenant`.
- `actions.ts`: `"use server"`. Pasos: `requirePermission(orgSlug, {...})`
  → `safeParse` con Zod → `withTenant` + `audit(tx, …)` → `revalidatePath`.
  Devuelve `{ ok, data } | { ok: false, error, fieldErrors? }`.
- `rules.ts` (opcional): lógica pura y testeable sin DB.

Las páginas del tenant viven en `src/app/app/[orgSlug]/<x>/` y usan `PageHeader`.

### Rutas

| Ruta                  | Quién             | Qué                                                            |
| --------------------- | ----------------- | -------------------------------------------------------------- |
| `/login`, `/register` | público           | Auth. El registro es un wizard: cuenta → gimnasio.             |
| `/app`                | sesión            | Redirige al gym activo, o a `/onboarding` si no tiene ninguno. |
| `/app/[orgSlug]/…`    | miembro de la org | Todo el tenant (`requireOrg` + `can`).                         |
| `/invite/[id]`        | sesión            | Acepta invitación (valida correo, vencimiento, estado).        |
| `/onboarding`         | sesión            | Crear otro gimnasio.                                           |
| `/suspended`          | sesión            | Gimnasio suspendido por la plataforma (superadmin).            |
| `/admin`              | superadmin        | Tenants, planes del SaaS, datos de cobro.                      |
| `/api/auth/*`         | —                 | Better Auth.                                                   |
| `/api/cron/expire`    | cron              | Consolida membresías vencidas (`CRON_SECRET`).                 |

`src/proxy.ts` solo comprueba la cookie de sesión y redirige a `/login?next=`.
La validación real (sesión, membresía, suspensión) ocurre en
`src/lib/auth/session.ts`.

## Estructura

```
src/
├── app/
│   ├── (auth)/              login, register
│   ├── app/[orgSlug]/       todo lo del tenant
│   │   ├── dashboard/       (_widgets/: vista "Negocio" / "Mi turno")
│   │   ├── members/[id]/ memberships/ plans/
│   │   ├── payments/        (quick/, debts/, cash-close/, [id]/receipt)
│   │   ├── cash/ expenses/ reports/
│   │   └── settings/        (general/, team/, plan/)
│   ├── admin/               superadmin: gyms/, plans/, billing/, [orgId]/
│   ├── invite/ onboarding/ suspended/
│   └── api/
├── db/                      schema/ (auth, tenants, business, platform), migrate.ts, seed.ts
├── lib/                     auth/, tenant.ts, money.ts, dates.ts, members/, validators/
├── modules/                 members, plans, subscriptions, payments, expenses, cash,
│                            reports, settings, platform, audit
└── components/              ui/ (shadcn/Base UI), smoothui/, motion/, data-table/,
                             forms/, layout/, members/, brand/
drizzle/                     NNNN_*.sql + meta/ (journal + snapshots), solo vía db:generate
tests/                       unit/, integration/ (Postgres real), e2e/ (Playwright)
```

Las constantes y labels que se usan en Server Components van en `src/lib/**`,
nunca en módulos `"use client"`.

## Modelo de datos

Toda tabla de negocio lleva `id uuid`, `org_id`, `created_at`,
`updated_at` y `deleted_at` (soft delete).

- **organization** (Better Auth) + `org_settings`: timezone, currency,
  nit, address, phone, logo_url, grace_days, receipt_prefix,
  day_pass_price_cents.
- **branches**: nombre, dirección (por ahora solo una etiqueta).
- **members**: document_type/number (único por org), nombres, contacto,
  photo_url (sin UI todavía), status, branch_id.
- **plans**: nombre, price_cents, duration_type/value, visit_limit, is_active.
- **subscriptions**: member_id, plan_id, start/end_date, status
  (active/expired/frozen/cancelled), price_cents_snapshot,
  visit_limit_snapshot/visits_used. Hoy nada incrementa `visits_used`;
  eso llega con el check-in. Al renovar, la nueva membresía empieza el día
  siguiente al `end_date` de la anterior si esta sigue activa.
- **payments**: member_id (nullable para venta rápida sin socio),
  subscription_id, branch_id, concept (membership/day_pass/product/other),
  payer_name, amount_cents, method (cash/transfer/card/other),
  receipt_number (secuencial por org), status (completed/voided).
- **expenses**: branch_id, category (rent/utilities/payroll/equipment/
  maintenance/supplies/other), description, amount_cents, method, status.
- **cash_closures**: branch_id, business_date, opening/counted/expected
  cash, difference, closed_by, reopened_at/by. Es único por
  (org, sede, fecha).
- **audit_log**: org_id, actor_id, action, entity, entity_id, diff jsonb.
- **Plataforma** (sin `org_id` de tenant, solo superadmin):
  `platform_plans`, `platform_settings` (datos bancarios/Nequi) y
  `tenant_subscriptions` (plan del SaaS por gimnasio: trial/active/expired).

Índices: `(org_id, document_number)` unique, `(org_id, status, end_date)`
en subscriptions, `(org_id, status, paid_at)` en payments,
`(org_id, status, spent_at)` en expenses, y `pg_trgm` en nombre/documento.
Hay FK compuestas `(org_id, member_id)`/`(org_id, plan_id)` que impiden, a
nivel de DB, que una org referencie el socio o el plan de otra.

### Migraciones

| #           | Contenido                                                        |
| ----------- | ---------------------------------------------------------------- |
| `0000-0001` | Auth/tenants + RLS base (`app_current_org_id`, `app_bypass_rls`) |
| `0002-0003` | Negocio (members, plans, subscriptions, payments, audit) + RLS   |
| `0004`      | FK compuestas, `payments.branch_id`, índices                     |
| `0005-0007` | Venta sin socio, expenses, cash_closures (+ `0006_rls_cuentas`)  |
| `0008`      | Cobro del SaaS (platform_plans/settings, tenant_subscriptions)   |
| `0009`      | Índice único de `cash_closures` parcial (`deleted_at is null`)   |

El siguiente número libre lo decide `pnpm db:generate` sobre `develop`
actualizado, nunca a mano (ver checklist).

## Roadmap y pendientes

El estado de cada feature (hecho, en curso, pendiente con prioridad), la
deuda técnica y las tareas de proceso viven en
[PENDIENTES.md](./PENDIENTES.md). Actualízalo al empezar y al mergear
cualquier cosa.

Resumen: v1 y Fase 5 ✅, cobro manual del SaaS ✅, centro de caja ✅.
Check-in, clases, sedes y foto del socio 🚧 en
`feature/phase1-enhancements`. Lo siguiente es hacer cumplir el plan del
SaaS, la configuración general y el portal del socio.

## Verificación

- `pnpm verify` (lint + typecheck + test) antes de cada PR, con Postgres
  levantado. En un clon nuevo, `pnpm exec next typegen` genera los tipos
  `PageProps`/`LayoutProps` que pide `typecheck`.
- Tests de integración contra Postgres real: aislamiento RLS entre
  tenants, reglas de vencimiento, saldos, caja.
- Playwright e2e de los flujos de negocio.
