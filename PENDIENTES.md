# AdminFit — Pendientes

Backlog vivo de features, deuda técnica y tareas de proceso. Arquitectura en
[ARCHITECTURE.md](./ARCHITECTURE.md), diseño en [DESIGN.md](./DESIGN.md).

**Cómo usarlo:**

- Antes de empezar algo, búscalo aquí. Si no está, agrégalo antes de abrir la rama.
- Al tomarlo, pásalo a **En curso** con tu nombre y la rama (`feature/<x>`
  desde `develop`).
- Al mergear a `develop`, pásalo a **Hecho** y actualiza el modelo de datos y
  las migraciones en `ARCHITECTURE.md` si cambió el schema.
- Prioridad: **P1** = bloquea vender o operar el producto · **P2** = siguiente
  ola · **P3** = idea o mejora.

## 🚧 En curso

| Feature                                                                                         | Quién         | Rama                          | Estado                                                                         |
| ----------------------------------------------------------------------------------------------- | ------------- | ----------------------------- | ------------------------------------------------------------------------------ |
| **Check-in**: tabla `checkins`, carnet QR por socio, kiosco de recepción; consume `visits_used` | Daniel Franco | `feature/phase1-enhancements` | En revisión. Falta rebase sobre `develop` y regenerar migraciones (ver abajo). |
| **Clases**: `trainers`, `class_types`, `class_sessions`, `class_bookings` con aforo             | Daniel Franco | `feature/phase1-enhancements` | En revisión. Misma rama.                                                       |
| **Sedes**: CRUD en Configuración → Sedes                                                        | Daniel Franco | `feature/phase1-enhancements` | En revisión. Debe usar `checkBranchLimit` (límite del plan SaaS).              |
| **Foto del socio** (UI de `members.photo_url`)                                                  | Daniel Franco | `feature/phase1-enhancements` | **Decidir almacenamiento** antes de mergear (hoy guarda base64 en la DB).      |

Lo que falta para mergear `feature/phase1-enhancements`:

- [ ] Rebase sobre `develop`. Borrar `0005_checkins`/`0006_classes` y
      regenerar con `pnpm db:generate`, más una migración `--custom` con el RLS.
- [ ] Revertir `tests/integration/setup.ts` (no debe tragarse los errores
      de DB o de migración).
- [ ] Resolver conflictos conservando lo de `develop`: reportes, tabs de
      settings, menú y permisos.
- [ ] Aforo con `SELECT … FOR UPDATE` sobre la sesión.
- [ ] Check-in:
  - [ ] Antiduplicado de escaneos seguidos.
  - [ ] Incremento atómico de `visits_used`.
  - [ ] Ignorar membresías con `startDate > hoy`.
- [ ] Validar que `trainerId`/`branchId` pertenezcan a la org.
- [ ] Recepción (`staff`) solo `gymClass: read, book`. Las páginas usan
      `requirePermission`.
- [ ] Tests de integración:
  - [ ] Tablas nuevas en `tenant-isolation.test.ts`.
  - [ ] Aforo concurrente.
  - [ ] Plan por visitas.

## 📋 Pendiente — producto

### P1

- **Hacer cumplir el plan del SaaS.** `tenant_subscriptions` (trial, active,
  expired) se asigna desde `/admin`, pero hoy **no restringe nada**:
  - Un gym con trial vencido sigue operando. Falta un aviso de N días antes
    y bloqueo o solo lectura al vencer.
  - De los límites solo se aplica `checkMemberLimit` (al crear socios).
    `checkBranchLimit` y `checkStaffLimit` existen en
    `src/modules/platform/limits.ts` pero nadie los llama (crear sede,
    invitar a alguien del equipo).
- **Configuración general del gym.** `settings/general` solo tiene el precio
  del pase del día. Faltan NIT, dirección, teléfono, logo, `grace_days` y
  `receipt_prefix`, que ya existen en `org_settings` y salen en los recibos.
- **Página 403 amable.** Una página protegida con `requirePermission` lanza
  `ForbiddenError` y el usuario ve el error genérico de Next ("This page
  couldn't load"). Falta un `forbidden()`/`notFound()` común, y que el menú
  ya no muestre esos enlaces.

### P2

- **Portal del socio (PWA):** rol `member`, ver su plan y vencimiento,
  carnet QR y reservar clases (depende de check-in y clases).
- **Pasarela de pago:** Wompi o Mercado Pago, con webhooks idempotentes, para
  que el socio pague o renueve en línea. Para el SaaS, que cada gym pague su
  plan sin que el superadmin lo asigne a mano.
- **Recordatorios de vencimiento:** email (Resend) o WhatsApp antes del
  vencimiento y durante la gracia. Hoy no hay email transaccional, y las
  invitaciones se comparten copiando el enlace.
- **Reportes de asistencia** (requiere check-in): ingresos por día y hora,
  socios inactivos y ocupación de clases.

### P3

- Inventario de productos para la venta rápida (hoy "producto" es solo un
  concepto con monto libre).
- Multi-moneda / multi-país (hoy todo es COP y `America/Bogota`).

## 🐞 Deuda técnica

- **Dashboard:** una sola tanda de queries por vista, sin `<Suspense>` por
  widget. Reconsiderar si se siente lento con datos reales.
- **Fin de línea:** no hay `.gitattributes`. En Windows, Prettier marca unos
  14 archivos por CRLF (`pnpm format:check` falla). Agregar
  `* text=auto eol=lf` y normalizar en un commit aparte.
- **Typecheck en clon nuevo:** `PageProps`/`LayoutProps` salen de
  `next typegen`. Sumarlo a `typecheck` o a un `postinstall`.

## ⚙️ Proceso e infraestructura

- **CI en GitHub Actions** (hoy no hay `.github/`). Los PR no corren nada:
  - Correr `pnpm verify` con Postgres de servicio.
  - Revisar que `pnpm db:generate` no deje cambios.
  - Correr Playwright.
- **Protección de ramas:** `main` y `develop` solo por PR, con CI en verde y
  al menos una revisión.
- **Deploy:** definir dónde corre producción (self-host o Vercel + Postgres
  gestionado). Hay que programar el cron `/api/cron/expire` y los backups de la DB.

## ✅ Hecho

- **v1:** auth y multi-tenancy con RLS, socios (CRUD, import CSV), planes y
  membresías (renovar, congelar, cancelar), pagos con recibo imprimible y
  anulación, dashboard con KPIs, superadmin (suspender tenant, impersonar).
- **Fase 5, "Las cuentas del gym":**
  - Matriz de permisos por rol.
  - Smooth UI + `motion`.
  - Venta rápida sin socio.
  - Gastos por sede y categoría.
  - Cartera.
  - Cierre de caja con arqueo ciego.
  - Dashboards "Negocio" / "Mi turno".
  - Reportes del mes + CSV.
- **Cobro manual del SaaS:** planes de plataforma, datos bancarios y Nequi,
  asignación de plan por gym y "Mi plan" para el owner.
- **Centro de caja:** KPIs, calendario de cierres, desempeño por cajero y
  CSV. Incluye un fix: se puede volver a cerrar después de reabrir
  (migración `0009`).
