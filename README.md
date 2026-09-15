# AdminFit

Plataforma multi-tenant para administrar socios, membresías y pagos de
gimnasios en Colombia. Ver [ARCHITECTURE.md](./ARCHITECTURE.md) para el
modelo de datos, la arquitectura multi-tenant y el roadmap completo.

## Stack

Next.js 16 (App Router) · TypeScript · Tailwind v4 · shadcn/ui ·
PostgreSQL · Drizzle ORM · Better Auth · pnpm.

## Requisitos

- Node.js ≥ 20.9
- pnpm ≥ 10
- Docker (para Postgres local)

## Desarrollo

```bash
pnpm install
cp .env.example .env          # completar DATABASE_URL / BETTER_AUTH_SECRET
docker compose up -d postgres # DB local (Fase 1+)
pnpm dev                      # http://localhost:3000
```

## Scripts

| Comando                                                | Qué hace                                                      |
| ------------------------------------------------------ | ------------------------------------------------------------- |
| `pnpm dev`                                             | Servidor de desarrollo (Turbopack)                            |
| `pnpm build` / `pnpm start`                            | Build y arranque de producción                                |
| `pnpm lint` / `pnpm lint:fix`                          | ESLint                                                        |
| `pnpm format` / `pnpm format:check`                    | Prettier                                                      |
| `pnpm typecheck`                                       | `tsc --noEmit`                                                |
| `pnpm test` / `pnpm test:watch` / `pnpm test:coverage` | Vitest (unit/integration)                                     |
| `pnpm test:e2e`                                        | Playwright                                                    |
| `pnpm verify`                                          | lint + typecheck + test — correr antes de cada commit de fase |

## Flujo de ramas: GitFlow

- **`main`** — siempre desplegable, solo recibe merges de `release/*` o
  `hotfix/*`, tag por versión (`v0.1.0`, ...).
- **`develop`** — rama de integración, base de toda `feature/*`.
- **`feature/<nombre>`** — una por fase/módulo (ej.
  `feature/auth-multitenancy`, `feature/members-plans`). Merge a
  `develop` al terminar.
- **`release/<version>`** — se corta de `develop` cuando una fase está
  lista, solo fixes menores, luego merge a `main` y `develop` + tag.
- **`hotfix/<nombre>`** — parches urgentes desde `main`, merge a `main` y
  `develop`.

Commits en [Conventional Commits](https://www.conventionalcommits.org/)
(`feat:`, `fix:`, `chore:`, `test:`, `docs:`).

## Tests

- `tests/unit/` y `tests/integration/` — Vitest.
- `tests/e2e/` — Playwright (levanta `pnpm dev` automáticamente).
