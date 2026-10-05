# AdminFit — Diseño y UI

Guía visual y de componentes. Arquitectura, modelo de datos y reglas de
ramas en [ARCHITECTURE.md](./ARCHITECTURE.md); convenciones de código en
[AGENTS.md](./AGENTS.md).

## Antes de empezar (personas y asistentes de IA)

- **Stack:** Next.js 16 (App Router) + TypeScript + pnpm · Tailwind v4 ·
  **shadcn/ui preset Nova sobre Base UI** (`@base-ui/react`, **no Radix**) ·
  lucide-react · Smooth UI + `motion` para animación · `recharts` para
  gráficas · react-hook-form + Zod · sonner (toasts) · next-themes.
- **GitFlow:** las `feature/*` salen de `develop` y vuelven a `develop` por PR.
  Nunca se trabaja sobre `main`. Commits en Conventional Commits. Ver el
  [checklist](./ARCHITECTURE.md#checklist-antes-de-abrir-pr).
- **Antes de usar una prop "recordada" de Radix o de shadcn clásico, abre
  el componente en `src/components/ui/*` y revisa su firma real.** Por
  ejemplo, `TooltipProvider` usa `delay`, no `delayDuration`, y `Button`
  con `Link` se escribe `nativeButton={false} render={<Link … />}`, no `asChild`.
- Next.js 16 cambia APIs respecto de versiones anteriores. Ante la duda,
  consulta `node_modules/next/dist/docs/`.

## Principios

Es un SaaS de administración, denso en datos, que usa recepción (muchas
veces en tablet) y el dueño del gimnasio.

- **Minimalismo moderno** (Linear/Vercel). Nada de glassmorphism ni
  neumorphism, ni gradientes decorativos.
- **Velocidad para recepción:** las acciones frecuentes (vender, cobrar,
  check-in) quedan a uno o dos clics y son usables con teclado y lector de QR.
- **El color nunca es el único indicador.** Todo estado lleva icono + texto.
- **Español de Colombia** en toda la UI. Montos en COP con
  `formatCOP` (`src/lib/money.ts`) y fechas con los helpers de
  `src/lib/dates.ts`.

## Tokens y tema

- Los tokens viven en `src/app/globals.css` (`@theme inline`). El dark mode
  va vía `next-themes` (`attribute="class"`). **No uses colores de Tailwind
  fijos** (`emerald-500`, `red-600`, `#3b82f6`…) para estados o branding:
  usa los tokens.
- **Neutros** slate/zinc (`background`, `foreground`, `muted`, `border`…).
- **Acento naranja** (`primary`): `oklch(0.646 0.222 41.116)` en claro y
  `oklch(0.705 0.213 47.604)` en oscuro. Solo para CTAs y branding.
- **Semánticos:** `success`, `warning`, `info` y `destructive` (con su
  `-foreground`). Úsalos para estados como membresía al día, por vencer,
  vencida, acceso concedido o denegado.
- **Tipografía:** Geist Sans en toda la UI, Geist Mono para códigos.
  `tabular-nums` en montos, contadores y tablas.

## Componentes

| Necesito…                                | Uso                                                                           |
| ---------------------------------------- | ----------------------------------------------------------------------------- |
| Inputs, selects, diálogos, tabs, sheets… | `src/components/ui/*` (shadcn sobre Base UI)                                  |
| Formularios                              | `Field`/`FieldLabel`/`FieldError` + react-hook-form + Zod                     |
| Tablas con filtros/orden/paginación      | `src/components/data-table/*` (TanStack, estado en la URL)                    |
| Encabezado de página                     | `PageHeader` (`src/components/layout/page-header.tsx`)                        |
| Animación de entrada, cifras, submit     | `src/components/motion/*` (`FadeIn`, `Stagger*`, `MoneyFlow`, `SubmitButton`) |
| Efectos más elaborados                   | `src/components/smoothui/*`                                                   |
| Gráficas                                 | `src/components/ui/chart.tsx`                                                 |
| Notificaciones                           | `toast` de `sonner`                                                           |

Reglas:

- Los títulos de `Card` que funcionan como encabezado llevan
  `role="heading" aria-level={2}`.
- Para agregar un componente shadcn nuevo, usa el CLI con el preset del
  proyecto; no copies código de la documentación de Radix.
- **Smooth UI** es otro registry de shadcn, sobre `motion` y no sobre Base UI.
  Su paleta por defecto (rosa/ámbar/azul/verde) está remapeada en
  `globals.css` al acento y a los semánticos. Antes de agregar un componente
  nuevo de ahí, revisa que no traiga colores propios sin remapear.

## Animación

- `MotionProvider` (`reducedMotion="user"`) en el layout raíz respeta
  `prefers-reduced-motion`. No lo saltes con animaciones CSS propias.
- `template.tsx` en `app/[orgSlug]/` da el fade entre páginas.
- `Stagger*` tiene un tope de 12 filas. En tablas largas no se anima cada fila.
- Las animaciones son cortas (150–300 ms) y funcionales, nunca decorativas en bucle.

## Gráficas

- Paleta categórica `--chart-1..8` en `globals.css`, en orden fijo y nunca
  ciclada. Está validada para daltonismo (ΔE ≥ 8 entre pares adyacentes)
  en claro y oscuro.
- Nunca doble eje Y: dos magnitudes distintas van en dos gráficas o en una
  indexada.
- La leyenda solo aparece con 2 o más series.
- Cada gráfica lleva un `aria-label` con el resumen en texto.

## Accesibilidad y responsive

- Contraste AA. Foco visible en todo lo interactivo (no quitar `outline`
  sin reemplazo).
- Objetivos táctiles de 40 px o más en pantallas de recepción (tablet).
- Layouts que funcionen desde 360 px. Las tablas anchas hacen scroll
  dentro de su contenedor, no la página.
- Las imágenes llevan `alt`; los avatares tienen fallback con iniciales.
