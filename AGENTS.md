<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# AdminFit — Convenciones del proyecto

SaaS multi-tenant de gestión de gimnasios (Colombia). Arquitectura,
modelo de datos y roadmap completos en `ARCHITECTURE.md`.

## Stack

Next.js 16 (App Router, Turbopack) + TypeScript + Tailwind v4 + shadcn/ui
(preset Nova, sobre **Base UI** — no Radix directamente, `@base-ui/react`)

- pnpm. DB: PostgreSQL + Drizzle ORM. Auth: Better Auth (plugin
  `organization`). Tests: Vitest (unit/integration) + Playwright (e2e).

## Reglas duras

- **`proxy.ts`, no `middleware.ts`.** Next.js 16 renombró el archivo y la
  función exportada de `middleware` a `proxy`. No usar la convención vieja.
- **APIs de request siempre async.** `cookies()`, `headers()`, `params`,
  `searchParams` son promesas — siempre `await`.
- **Multi-tenancy vía `withTenant(orgId, fn)`.** Ninguna query de negocio
  se ejecuta fuera de este helper (fija `org_id` para RLS). Ver
  `src/lib/tenant.ts` cuando exista (Fase 1).
- **Dinero en enteros (centavos).** Nunca `float`/`number` decimal para
  montos. Formatear con `Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP' })`.
- **Fechas con `date-fns` + TZ `America/Bogota`** para cálculos de
  vencimiento de membresías.
- **Componentes shadcn son de Base UI**, no Radix: props como
  `delayDuration` no existen (es `delay` en `TooltipProvider`, por
  ejemplo). Verificar la firma real del componente en
  `src/components/ui/*` antes de usar props "recordadas" de Radix.
- **Validación con Zod en cada boundary** (Server Action, route handler).
- Commits en **Conventional Commits** (`feat:`, `fix:`, `chore:`, `test:`,
  `docs:`). Flujo de ramas: **GitFlow** (`main`, `develop`,
  `feature/*`, `release/*`, `hotfix/*|`) — detalle en `README.md`.

## Comandos

```
pnpm dev            # next dev (Turbopack)
pnpm verify          # lint + typecheck + test — correr antes de cada commit de fase
pnpm test:e2e         # Playwright (requiere pnpm dev o lo levanta el propio config)
docker compose up -d postgres   # DB local (Fase 1+)
```
