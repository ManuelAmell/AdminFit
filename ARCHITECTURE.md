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
│   │   ├── dashboard/ members/[id]/ memberships/ plans/ payments/ reports/ settings/
│   ├── (platform)/admin/   ← superadmin
│   └── api/
├── db/ (schema/, rls.sql, migrate.ts, seed.ts)
├── lib/ (auth/, tenant.ts, money.ts, dates.ts, validators/)
├── modules/ (members/, plans/, subscriptions/, payments/, reports/, audit/)
└── components/ (ui/, data-table/, forms/, layout/)
```

## Modelo de datos (v1)

Toda tabla de negocio lleva `id uuid`, `org_id`, `created_at`,
`updated_at`, `deleted_at` (soft delete).

- **organization** (Better Auth) + `org_settings`: timezone, currency,
  nit, address, phone, logo_url, grace_days, receipt_prefix.
- **branches**: nombre, dirección (v1: solo etiqueta).
- **members**: document_type/number (único por org), nombres, contacto,
  photo_url, status, branch_id.
- **plans**: nombre, price_cents, duration_type/value, visit_limit,
  is_active.
- **subscriptions**: member_id, plan_id, start/end_date, status
  (active/expired/frozen/cancelled), price_cents_snapshot. Al renovar, la
  nueva empieza al `end_date` de la anterior si sigue activa.
- **payments**: member_id, subscription_id (nullable), amount_cents,
  method (cash/transfer/card/other), receipt_number (secuencial por
  org), status (completed/voided).
- **audit_log**: org_id, actor_id, action, entity, entity_id, diff jsonb.

Índices: `(org_id, document_number)` unique, `(org_id, status, end_date)`
en subscriptions, `(org_id, paid_at)` en payments, `pg_trgm` en
nombre/documento.

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

## Roadmap

**v1**: auth + multi-tenancy ✅ → socios ✅ → planes y membresías ✅ →
pagos ✅ → dashboard con KPIs/reportes (pendiente) → superadmin completo
(pendiente: suspender tenant, impersonar).

Deuda técnica detectada por los módulos (no implementada, requiere
migración `0004`):

- FK compuestas `(org_id, member_id)` / `(org_id, plan_id)` en
  `subscriptions` y `payments`: RLS aísla por `org_id`, pero a nivel DB una
  org podría referenciar un socio/plan de otra (las actions ya lo impiden).
- `payments.branch_id` para cierre de caja por sede; índice
  `(org_id, status, paid_at)`.
- Foto del socio (`members.photo_url` sin UI).

**Después**:

1. **Check-in**: tabla `checkins`, QR por socio, pantalla kiosco.
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
