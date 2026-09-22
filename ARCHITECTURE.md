# AdminFit — Arquitectura

SaaS multi-tenant para gestión de gimnasios en Colombia. La v1 cubre
**socios, membresías y pagos manuales**; la arquitectura deja el terreno
listo para check-in, clases, portal del socio y pasarela de pagos sin
rehacer nada.

## Stack

| Capa             | Elección                                                                      | Motivo                                                  |
| ---------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------- |
| Framework        | Next.js 16 (App Router, Turbopack) + TypeScript + pnpm                        | Full-stack en un repo, Server Actions, RSC.             |
| DB               | PostgreSQL 16 + Drizzle ORM                                                   | Tipado end-to-end, migraciones versionadas, RLS nativo. |
| Auth             | Better Auth + plugin `organization`                                           | Orgs, miembros, roles e invitaciones out-of-the-box.    |
| UI               | Tailwind v4 + shadcn/ui (preset Nova sobre Base UI) + lucide + TanStack Table | Tablas con filtros/orden/paginación server-side.        |
| Forms/validación | react-hook-form + Zod                                                         | Compartido entre cliente, Server Actions y seed.        |
| Money            | `integer` en centavos + `Intl.NumberFormat('es-CO')`                          | Evita floats.                                           |
| Fechas           | `date-fns` + `date-fns-tz`, TZ `America/Bogota`                               | Vencimientos correctos.                                 |
| Tests            | Vitest (unit/integration) + Playwright (e2e)                                  |                                                         |
| Infra            | Docker Compose (Postgres), self-host                                          |                                                         |

## Multi-tenancy

**Base de datos compartida, esquema compartido, columna `org_id` en toda
tabla de negocio + Row Level Security de Postgres como segunda barrera.**

- Better Auth gestiona `organization`, `member`, `invitation` y la
  "active organization" en sesión.
- Cada request de servidor obtiene `orgId` de la sesión y lo pasa a
  `withTenant(orgId, fn)`, que hace `SET LOCAL app.org_id = ...` dentro de
  una transacción; las policies RLS filtran por
  `current_setting('app.org_id')`.
- Todas las queries de negocio pasan por ese helper → imposible olvidar
  el `where org_id`.
- Roles por org (`member.role`): `owner`, `admin`, `staff`; permisos
  declarados en `src/lib/auth/permissions.ts` (access control de Better
  Auth, compartido server/cliente). Rol de plataforma (`user.role`, plugin
  `admin`): `user` | `superadmin` — superadmin ve `/admin` y puede abrir
  cualquier gym.
- **Info sensible por rol, no solo por UI** (Fase 5): `finance.read`
  (cifras agregadas del negocio — ingresos/utilidad/cartera total),
  `payment.readAll`/`cashClosure.readAll` (ver lo de otros usuarios, no
  solo lo propio), `expense.readPayroll` (categoría nómina). Recepción no
  tiene ninguno de los tres: sus queries reciben un `scope` (`recordedBy`,
  `excludePayroll`) que filtra en el WHERE, no algo que se calcula igual y
  se esconde después. `can(ctx, permisos)` en `src/lib/auth/permissions.ts`
  es el helper para chequear esto en Server Components, Client Components
  (el menú lateral) y Server Actions por igual.
- **La conexión a Postgres debe ser un rol no superusuario** (RLS se ignora
  para superusuarios). Ver `docker/postgres-init.sql` y `scripts/pg-local.mjs`.
- Invitaciones: sin email transaccional en v1; el owner/admin copia el
  enlace `/invite/[id]` desde Configuración → Equipo. `/register?next=/invite/…`
  crea solo la cuenta (sin gimnasio).

### Rutas

| Ruta                  | Quién             | Qué                                                            |
| --------------------- | ----------------- | -------------------------------------------------------------- |
| `/login`, `/register` | público           | Auth. Registro = wizard cuenta → gimnasio.                     |
| `/app`                | sesión            | Redirige al gym activo, o a `/onboarding` si no tiene ninguno. |
| `/app/[orgSlug]/…`    | miembro de la org | Todo el tenant (`requireOrg`).                                 |
| `/invite/[id]`        | sesión            | Acepta invitación (valida correo, vencimiento, estado).        |
| `/onboarding`         | sesión            | Crear otro gimnasio.                                           |
| `/admin`              | superadmin        | Lista de tenants.                                              |
| `/api/auth/*`         | —                 | Better Auth.                                                   |

`src/proxy.ts` (Next 16, antes `middleware`) solo comprueba la cookie de
sesión y redirige a `/login?next=`; la validación real (sesión, membresía,
suspensión) ocurre en `src/lib/auth/session.ts`.

## Estructura

```
src/
├── app/
│   ├── (auth)/login, register, invite/[id]
│   ├── (app)/[orgSlug]/    ← todo lo del tenant
│   │   ├── dashboard/ (_widgets/ — gráficas "Negocio" / "Mi turno")
│   │   ├── members/[id]/ memberships/ plans/
│   │   ├── payments/ (quick/, debts/, cash-close/) expenses/[id]/ reports/ settings/
│   ├── (platform)/admin/   ← superadmin
│   └── api/
├── db/ (schema/, rls.sql, migrate.ts, seed.ts)
├── lib/ (auth/, tenant.ts, money.ts, dates.ts, validators/)
├── modules/ (members/, plans/, subscriptions/, payments/, expenses/, cash/, reports/, settings/, audit/)
└── components/ (ui/ — shadcn/Base UI, smoothui/ — Smooth UI, motion/ — wrappers propios
    sobre "motion", data-table/, forms/, layout/)
```

## Modelo de datos (v1)

Toda tabla de negocio lleva `id uuid`, `org_id`, `created_at`,
`updated_at`, `deleted_at` (soft delete).

- **organization** (Better Auth) + `org_settings`: timezone, currency,
  nit, address, phone, logo_url, grace_days, receipt_prefix,
  day_pass_price_cents.
- **branches**: nombre, dirección (v1: solo etiqueta).
- **members**: document_type/number (único por org), nombres, contacto,
  photo_url (sin UI todavía), status, branch_id.
- **plans**: nombre, price_cents, duration_type/value, visit_limit,
  is_active.
- **subscriptions**: member_id, plan_id, start/end_date, status
  (active/expired/frozen/cancelled), price_cents_snapshot,
  visit_limit_snapshot/visits_used (guardados, sin UI de consumo — pase
  del día real sería consumir visitas, no está hecho). Al renovar, la
  nueva empieza al `end_date` de la anterior si sigue activa.
- **payments**: member_id (nullable desde Fase 5 — venta rápida sin
  socio), subscription_id (nullable), branch_id, concept
  (membership/day_pass/product/other), payer_name (si no hay socio),
  amount_cents, method (cash/transfer/card/other), receipt_number
  (secuencial por org), status (completed/voided). Checks: siempre hay
  socio o payer_name; "membership" exige socio.
- **expenses** (Fase 5): branch_id, category (rent/utilities/payroll/
  equipment/maintenance/supplies/other), description, amount_cents,
  method, status (completed/voided, igual que payments).
- **cash_closures** (Fase 5): branch_id, business_date, opening/counted/
  expected_cash_cents, difference_cents, closed_by, reopened_at/by
  (reabrir = soft delete de la fila, no se pierde el historial). Único
  por (org_id, sede, fecha) — sedes null cuentan como una sola vía
  `coalesce` en el índice.
- **audit_log**: org_id, actor_id, action, entity, entity_id, diff jsonb.

Índices: `(org_id, document_number)` unique, `(org_id, status, end_date)`
en subscriptions, `(org_id, paid_at)` y `(org_id, status, paid_at)` en
payments, `(org_id, status, spent_at)` en expenses, `pg_trgm` en
nombre/documento. FK compuestas `(org_id, member_id)`/`(org_id, plan_id)`
en subscriptions y `(org_id, member_id)` en payments (impiden a nivel de
DB que una org referencie el socio/plan de otra).

## Sistema de diseño

Producto SaaS admin dashboard, denso en datos, usado por recepción (a
menudo en tablet). Minimalismo moderno (Linear/Vercel), nunca
glassmorphism/neumorphism. Neutros slate/zinc + acento naranja
(`oklch(0.646 0.222 41.116)` claro / `oklch(0.705 0.213 47.604)` oscuro)
para CTAs y branding. Semánticos aparte: success/warning/info/destructive
(siempre icono + texto, nunca solo color). Tipografía Geist Sans en toda
la UI, cifras tabulares en montos y tablas. Tokens de tema en
`src/app/globals.css` (`@theme inline`), dark mode vía `next-themes`
(`attribute="class"`).

**Animación** (Fase 5): componentes de [Smooth UI](https://smoothui.dev)
en `src/components/smoothui/` (registry de shadcn, sobre `motion`) —
separados de `src/components/ui/` (Base UI) y con su paleta decorativa
remapeada al acento naranja/semánticos del proyecto en `globals.css`, no
al rosa/ámbar por defecto. `src/components/motion/` son wrappers propios
con esos tokens: `MoneyFlow` (cifra en COP que cuenta), `Stagger*`
(entrada escalonada, tope de 12 filas), `FadeIn`/`Collapse`, `SubmitButton`
(carga → check). `MotionProvider` (`reducedMotion="user"`) en el layout
raíz respeta `prefers-reduced-motion` en toda la app. `template.tsx` en
`app/[orgSlug]/` da el fade de página a página.

**Gráficas**: `src/components/ui/chart.tsx` (shadcn sobre `recharts`).
Paleta categórica `--chart-1..8` en `globals.css`, tomada del skill
`dataviz` (orden fijo, nunca ciclado; validada con
`validate_palette.js` para CVD Delta E >= 8 en pares adyacentes, claro y
oscuro) — no la gris de la plantilla original. Nunca doble eje Y (dos
magnitudes distintas → dos gráficas o una indexada); leyenda solo con

> = 2 series; cada gráfica lleva `aria-label` con el resumen en texto.

## Roadmap

**v1** (`main`): auth + multi-tenancy ✅ → socios ✅ → planes y
membresías ✅ → pagos ✅ → dashboard con KPIs/reportes ✅ → superadmin
completo ✅ (suspender tenant, impersonar). Deuda técnica de v1 (FK
compuestas, `payments.branch_id`, índice `(org_id, status, paid_at)`)
resuelta en la migración `0004`. Pendiente sin resolver: foto del socio
(`members.photo_url` sin UI).

**Fase 5 — "Las cuentas del gym"** (`feature/cuentas`, sobre `develop`):
cierra el círculo contable para un gym de barrio.

1. Matriz de permisos por rol y fugas de info sensible cerradas ✅
2. Smooth UI + `motion`, primeras pantallas animadas ✅
3. Migraciones `0005`-`0007` (venta sin socio, expenses, cash_closures) ✅
4. Venta rápida (pase del día / producto / otro) ✅
5. Módulo de gastos (por sede/categoría, scope por rol) ✅
6. Cartera (socios con saldo pendiente) ✅
7. Cierre de caja real (arqueo ciego, esperado vs. contado) ✅
8. Dashboards con gráficas (vista Negocio / vista Mi turno) ✅
9. Reportes: resumen del mes elegido + exportar CSV ✅

Deuda técnica dejada por Fase 5 (no bloquea, pero hay que anotarla antes
de seguir sumando módulos):

- `visits_used`/`visit_limit_snapshot` se guardan pero nada los incrementa
  ni los consulta — un plan "por visitas" hoy se comporta igual que uno
  sin límite. Hace falta check-in para que tenga sentido (ver abajo).
- Sin Docker en el entorno donde se hizo Fase 5, las migraciones
  `0005`-`0007` y los tests de integración no se corrieron contra
  Postgres real — revisar con `pnpm db:migrate` + `pnpm verify` antes de
  mergear a `develop`.
- No hay UI de configuración general (nit, dirección, teléfono, logo,
  grace_days, receipt_prefix) — settings/general/ solo tiene el precio
  del pase del día, lo único que esta fase necesitaba.
- Gráficas del dashboard: una sola tanda de queries en paralelo por
  vista, no streaming por widget con `<Suspense>` individual — para el
  volumen de datos de un gym de barrio no hacía falta la complejidad
  extra; reconsiderar si el dashboard se siente lento con datos reales.

**Después**:

1. **Check-in**: tabla `checkins`, QR por socio, pantalla kiosco —
   también es lo que le daría uso real a `visits_used`.
2. **Clases y entrenadores**: `trainers`, `class_types`, `class_sessions`, `bookings`.
3. **Portal del socio (PWA)**: rol `member`, ver plan, reservar.
4. **Pasarela de pago**: Wompi/Mercado Pago, webhooks.
5. **Comunicaciones**: recordatorios de vencimiento (Resend).
6. **v2**: cobro del SaaS por tenant, límites por tier.

## Verificación

- `pnpm verify` (lint + typecheck + test) en cada fase.
- Integration tests con Postgres real: aislamiento RLS entre tenants,
  reglas de vencimiento, saldos.
- Playwright e2e del flujo de negocio completo.
