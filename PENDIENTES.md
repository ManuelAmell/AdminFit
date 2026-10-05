# Pendientes

Lista de lo que falta en AdminFit. Edítala directo en el repo.

**Reglas:**

1. Un ítem por línea.
2. Al empezar algo, ponle tu nombre y la rama: `(@nombre, feature/x)`.
3. Al mergearlo a `develop`, márcalo `[x]` y muévelo a **Hecho**.

Plantilla para copiar:

```
- [ ] **Título corto**: qué hay que hacer y por qué. (@quién, feature/rama)
```

---

## En curso

- [ ] **Check-in con QR y kiosco**: registra ingresos y descuenta visitas en planes por visitas. (@Daniel, feature/phase1-enhancements)
- [ ] **Clases y entrenadores**: horarios, reservas y control de aforo. (@Daniel, feature/phase1-enhancements)
- [ ] **Sedes**: crear y editar sedes en Configuración. Debe respetar el límite del plan (`checkBranchLimit`). (@Daniel, feature/phase1-enhancements)
- [ ] **Foto del socio**: falta decidir dónde se guardan las fotos; hoy van en base64 dentro de la DB. (@Daniel, feature/phase1-enhancements)

### Qué falta para mergear `feature/phase1-enhancements`

- [ ] Rebase sobre `develop` y regenerar las migraciones con `pnpm db:generate` (borrar `0005_checkins` y `0006_classes`).
- [ ] Migración aparte con el RLS de las tablas nuevas (`pnpm db:generate --custom --name rls_checkins_classes`).
- [ ] Revertir `tests/integration/setup.ts`: no debe esconder errores de DB.
- [ ] Resolver conflictos conservando lo de `develop` (reportes, tabs de settings, menú, permisos).
- [ ] Aforo: bloquear la sesión (`FOR UPDATE`) antes de contar las reservas.
- [ ] Check-in: que un doble escaneo no descuente dos visitas.
- [ ] Check-in: no usar membresías que todavía no empiezan.
- [ ] Validar que el entrenador y la sede sean del mismo gimnasio.
- [ ] Recepción solo puede ver y reservar clases, no configurarlas.
- [ ] Tests: tablas nuevas en `tenant-isolation.test.ts`, aforo concurrente y plan por visitas.

---

## Por hacer

### Prioridad alta

- [ ] **Bloquear gym con plan del SaaS vencido**: hoy un trial vencido sigue operando. Avisar unos días antes y pasar a solo lectura al vencer.
- [ ] **Límite de sedes y de equipo del plan**: `checkBranchLimit` y `checkStaffLimit` existen pero no se usan.
- [ ] **Configuración general del gym**: NIT, dirección, teléfono, logo, días de gracia y prefijo del recibo.
- [ ] **Página "sin permiso"**: hoy, entrar sin permiso muestra el error genérico "This page couldn't load".

### Siguiente

- [ ] **Portal del socio (app/PWA)**: ver su plan, el vencimiento, el carnet QR y reservar clases.
- [ ] **Pagos en línea**: Wompi o Mercado Pago, para socios y para que cada gym pague su plan del SaaS.
- [ ] **Recordatorios de vencimiento** por email o WhatsApp.
- [ ] **Reportes de asistencia**: horas pico, socios inactivos, ocupación de clases.

### Ideas

- [ ] Inventario de productos para la venta rápida.
- [ ] Soporte para otros países y monedas.

---

## Deuda técnica

- [ ] Agregar `.gitattributes` (`* text=auto eol=lf`): en Windows, Prettier marca unos 14 archivos por saltos de línea CRLF.
- [ ] Que `pnpm typecheck` funcione en un clon nuevo sin correr antes `pnpm exec next typegen`.
- [ ] Dashboard: cargar cada gráfica por separado (`<Suspense>`) si se siente lento con datos reales.

## Proceso

- [ ] **CI en GitHub Actions**: `pnpm verify`, revisar que `pnpm db:generate` no deje cambios, y e2e en cada PR.
- [ ] **Proteger `main` y `develop`**: solo por PR, con CI en verde y una revisión.
- [ ] **Deploy**: elegir dónde corre producción, programar el cron `/api/cron/expire` y los backups.

---

## Hecho

- [x] v1: auth y multi-gimnasio, socios (incluye importar CSV), planes y membresías, pagos y recibos, dashboard, superadmin.
- [x] Permisos por rol (recepción no ve cifras sensibles).
- [x] Venta rápida (pase del día, productos, otros cobros).
- [x] Gastos por sede y categoría.
- [x] Cartera: socios con saldo pendiente.
- [x] Cierre de caja con arqueo ciego.
- [x] Dashboards "Negocio" y "Mi turno" con gráficas.
- [x] Reportes del mes con exportación CSV.
- [x] Cobro manual del SaaS: planes, datos bancarios y plan por gym.
- [x] Centro de caja: KPIs, calendario de cierres, desempeño por cajero.
- [x] Fix: se puede volver a cerrar la caja después de reabrirla.
