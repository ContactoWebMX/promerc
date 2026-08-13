# Notificaciones Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir un sistema de notificaciones con dos canales — campanita in-app (badge + dropdown, actualizado por polling) y correo con evidencia adjunta (enviado por un cron) — para los 4 eventos de "ciclo completo" (Pesaje completado, Compra registrada, Venta cerrada, Venta requiere aprobación), con una pantalla de administración donde un `ADMIN` decide quién recibe qué.

**Architecture:** Tres piezas desacopladas, sin infraestructura nueva pesada. (1) Cada Server Action que cierra un ciclo llama, después de que su operación principal ya tuvo éxito, a un helper `crearNotificacion()` que resuelve destinatarios contra una tabla de reglas y escribe filas — nunca bloquea ni revierte la operación si falla. (2) Un endpoint de polling (`GET /api/notificaciones`) alimenta un componente cliente (`NotificationBell`) integrado en `AppNav`. (3) Un endpoint de cron (`POST /api/cron/notificaciones`, protegido con un secreto) revisa destinatarios con correo pendiente y los envía con Nodemailer (mismo transporte que ya usa `email.ts`), con reintentos limitados.

**Tech Stack:** Next.js 16 App Router (Server Actions, Route Handlers), Prisma 7 (`@/generated/prisma/client` vía `@/lib/db`), Nodemailer (ya instalado), Tailwind (clases ya definidas en `src/components/ui/*`).

## Global Constraints

- Spec aprobado: `docs/superpowers/specs/2026-08-13-notificaciones-design.md` — cualquier duda sobre alcance, resolver ahí primero.
- Alias de imports: `@/*` → `./src/*`. Prisma client se importa de `@/generated/prisma/client` (instancia única en `src/lib/db.ts`) o tipos/enums de `@/generated/prisma/enums` — nunca de `@prisma/client` directo.
- **`server-only` rompe los tests con `tsx --test`**: cualquier archivo con `import "server-only"` lanza `Error: This module cannot be imported from a Client Component module` bajo Node plano (ya pasó en esta sesión con `storage.ts`). Por eso la lógica pura testeable (`src/lib/notificaciones.ts`, Task 2) va **sin** `server-only`, separada de la que sí toca Prisma/red (`notificaciones-server.ts`, `notificaciones-email.ts`, Tasks 3-4) — mismo patrón que `image-type.ts`/`storage.ts` de esta misma sesión.
- **Nunca usar `.bind()` en una Server Action pasada a `useActionState`** — causa un loop infinito real en esta versión de Next/Turbopack. No aplica directo a este plan (no hay `.bind()` en ningún paso), pero si algún paso de revisión propone pasar datos extra a una Server Action, usar un campo oculto del formulario en su lugar (ver `hiddenId`/`hiddenFields` de `CatalogForm`).
- **Campos opcionales de formulario**: usar `.nullish()` en Zod, no `.optional()` — `formData.get()` regresa `null` (no `undefined`) cuando el campo está ausente.
- Antes de escribir código de Route Handlers nuevo (Tasks 5, 9), si algo no se comporta como se espera, revisar `node_modules/next/dist/docs/01-app/` — esta versión de Next (16.2.10) tiene cambios respecto al conocimiento previo de cualquier modelo (`cookies()`/`headers()` async-only, límites de Server Actions, etc.).
- Verificación estándar por tarea: `npx tsc --noEmit && npm run lint`, más `npm test` en las tareas con test dedicado. Cada test nuevo se agrega explícitamente a la lista del script `"test"` en `package.json` (no hay autodescubrimiento).
- Usuarios de prueba locales: `admin@promerc.local` / `operador.ecatepec@promerc.local` (rol OPERADOR), password `test1234`. DB local: `postgresql://promerc:promerc_dev@localhost:5432/promerc_dev`. Node del sistema puede ser viejo — usar `export PATH="$HOME/.nvm/versions/node/v22.23.1/bin:$PATH"` si hace falta antes de cualquier comando `npm`/`npx`.

---

## File Structure

- **Modificar** `prisma/schema.prisma` — nuevo enum `TipoNotificacion` y modelos `Notificacion`, `NotificacionDestinatario`, `ReglaNotificacion`; relaciones inversas en `Usuario` y `Ubicacion`.
- **Crear** `src/lib/notificaciones.ts` — lógica pura (sin `server-only`, testeable): resolución de destinatarios, filtrado de precio por rol, labels de tipo, tipos TS de los payloads de resumen.
- **Crear** `src/lib/notificaciones.test.ts` — tests de lo anterior.
- **Crear** `src/lib/notificaciones-server.ts` — `crearNotificacion()`: resuelve reglas contra la BD y escribe `Notificacion`+`NotificacionDestinatario`, nunca lanza (atrapa y loguea).
- **Crear** `src/lib/notificaciones-email.ts` — arma asunto/HTML/adjunto de un correo de notificación, resolviendo la evidencia según el tipo de evento.
- **Modificar** `src/lib/email.ts` — nueva función genérica `enviarCorreo()` (reutiliza el mismo `transporter`).
- **Crear** `src/app/api/cron/notificaciones/route.ts` — `POST` protegido por `CRON_SECRET`, procesa el lote de correos pendientes.
- **Modificar** `src/app/(app)/pesajes/[id]/actions.ts` — disparo `PESAJE_COMPLETADO` en `cerrarPesaje`.
- **Modificar** `src/app/(app)/compras/nuevo/[pesajeId]/actions.ts` — disparo `COMPRA_REGISTRADA` en `crearCompra`.
- **Modificar** `src/app/(app)/ventas/[id]/actions.ts` — disparo `VENTA_CERRADA`/`VENTA_REQUIERE_APROBACION` en `reportarPesoVenta`, y `VENTA_CERRADA` en `aprobarExcepcionTolerancia`.
- **Crear** `src/app/api/notificaciones/route.ts` — `GET`, polling de la campanita.
- **Crear** `src/app/api/notificaciones/[id]/leer/route.ts` — `POST`, marcar una leída.
- **Crear** `src/app/api/notificaciones/leer-todas/route.ts` — `POST`, marcar todas leídas.
- **Crear** `src/components/notification-bell.tsx` — campanita (client component).
- **Modificar** `src/components/app-nav.tsx` — integrar `NotificationBell`.
- **Modificar** `src/lib/validations/catalogos.ts` — `reglaNotificacionSchema`.
- **Crear** `src/app/(app)/catalogos/notificaciones/page.tsx` — listado (solo `ADMIN`).
- **Crear** `src/app/(app)/catalogos/notificaciones/actions.ts` — `saveReglaNotificacion`, `toggleReglaNotificacionActivo`.
- **Crear** `src/app/(app)/catalogos/notificaciones/[id]/page.tsx` — formulario crear/editar.
- **Modificar** `src/app/(app)/catalogos/page.tsx` — link "Notificaciones" en el hub de catálogos.
- **Modificar** `.env.production.example` y `DEPLOY.md` — documentar `CRON_SECRET` y el paso de Cron Job de cPanel.
- **Modificar** `package.json` — agregar `src/lib/notificaciones.test.ts` al script `test`.

---

### Task 1: Modelo de datos — schema y migración

**Files:**
- Modify: `prisma/schema.prisma`

**Interfaces:**
- Consumes: nada nuevo.
- Produces: enum `TipoNotificacion` (`PESAJE_COMPLETADO`, `COMPRA_REGISTRADA`, `VENTA_CERRADA`, `VENTA_REQUIERE_APROBACION`) y modelos `Notificacion`, `NotificacionDestinatario`, `ReglaNotificacion` — tipos generados en `@/generated/prisma/client` y `@/generated/prisma/enums`, usados por todas las tareas siguientes.

- [ ] **Step 1: Agregar el enum y los 3 modelos al final de `prisma/schema.prisma`**

El archivo termina hoy (línea 383 en adelante) con el modelo `AuditLog`. Agregar esto justo después de su cierre `}`:

```prisma
enum TipoNotificacion {
  PESAJE_COMPLETADO
  COMPRA_REGISTRADA
  VENTA_CERRADA
  VENTA_REQUIERE_APROBACION
}

// Un registro por evento ocurrido (no por destinatario) — el resumen se
// guarda una sola vez, sin filtrar por rol; el filtrado (ej. ocultar precio
// para OPERADOR) ocurre al leer, ver resumenParaRol() en src/lib/notificaciones.ts.
model Notificacion {
  id          Int              @id @default(autoincrement())
  tipo        TipoNotificacion
  entidad     String // "Pesaje" | "Compra" | "Venta" — mismos valores que AuditLog.entidad
  entidadId   Int
  ubicacionId Int
  ubicacion   Ubicacion        @relation(fields: [ubicacionId], references: [id])
  resumen     Json
  createdAt   DateTime         @default(now())

  destinatarios NotificacionDestinatario[]

  @@index([entidad, entidadId])
}

// Estado de entrega por destinatario — separado de Notificacion porque cada
// quien lee y recibe correo de forma independiente.
model NotificacionDestinatario {
  id              Int          @id @default(autoincrement())
  notificacionId  Int
  notificacion    Notificacion @relation(fields: [notificacionId], references: [id])
  usuarioId       Int
  usuario         Usuario      @relation(fields: [usuarioId], references: [id])
  leidoEn         DateTime?
  requiereCorreo  Boolean // resuelto de ReglaNotificacion al crear — no se re-evalúa después
  correoEnviadoEn DateTime?
  correoIntentos  Int          @default(0)
  correoError     String?
  createdAt       DateTime     @default(now())

  @@index([usuarioId, leidoEn])
  @@index([requiereCorreo, correoEnviadoEn, correoIntentos])
}

// Configuración que arma el ADMIN: quién recibe qué. ubicacionId null =
// aplica a todas las ubicaciones. Un usuario puede tener varias reglas para
// el mismo tipo (ej. una específica de su sede y otra general) — al
// resolver destinatarios se agrupan por usuario y los canales se combinan
// con OR (ver resolverDestinatarios() en src/lib/notificaciones.ts), así
// que tener más de una regla que aplique nunca "resta" un canal.
model ReglaNotificacion {
  id          Int              @id @default(autoincrement())
  tipo        TipoNotificacion
  usuarioId   Int
  usuario     Usuario          @relation(fields: [usuarioId], references: [id])
  ubicacionId Int?
  ubicacion   Ubicacion?       @relation(fields: [ubicacionId], references: [id])
  canalInApp  Boolean          @default(true)
  canalCorreo Boolean          @default(false)
  activo      Boolean          @default(true)
  createdAt   DateTime         @default(now())

  @@index([tipo, activo])
}
```

- [ ] **Step 2: Agregar las relaciones inversas en `Usuario`**

En el modelo `Usuario` (línea 69), el bloque de relaciones termina así:

```prisma
  pesajesCreados             Pesaje[]             @relation("PesajeCreadoPor")
  ventasCreadas              Venta[]              @relation("VentaCreadaPor")
  ventasReportadasPorCliente Venta[]              @relation("VentaReportadaPorCliente")
  evidencias                 Evidencia[]
  firmas                     Firma[]
  auditLogs                  AuditLog[]
  resetTokens                PasswordResetToken[]
}
```

Reemplazar por:

```prisma
  pesajesCreados             Pesaje[]             @relation("PesajeCreadoPor")
  ventasCreadas              Venta[]              @relation("VentaCreadaPor")
  ventasReportadasPorCliente Venta[]              @relation("VentaReportadaPorCliente")
  evidencias                 Evidencia[]
  firmas                     Firma[]
  auditLogs                  AuditLog[]
  resetTokens                PasswordResetToken[]
  notificaciones             NotificacionDestinatario[]
  reglasNotificacion         ReglaNotificacion[]
}
```

- [ ] **Step 3: Agregar las relaciones inversas en `Ubicacion`**

En el modelo `Ubicacion` (línea 54), el bloque de relaciones termina así:

```prisma
  usuarios Usuario[]
  pesajes  Pesaje[]
  compras  Compra[]
  ventas   Venta[]
  lotes    Lote[]
}
```

Reemplazar por:

```prisma
  usuarios Usuario[]
  pesajes  Pesaje[]
  compras  Compra[]
  ventas   Venta[]
  lotes    Lote[]

  notificaciones     Notificacion[]
  reglasNotificacion ReglaNotificacion[]
}
```

- [ ] **Step 4: Crear y aplicar la migración en desarrollo**

Run: `npx prisma migrate dev --name notificaciones`
Expected: crea `prisma/migrations/<timestamp>_notificaciones/migration.sql` y lo aplica a la DB local, sin pedir resetear datos (es un cambio puramente aditivo — nuevo enum, nuevas tablas, nuevas columnas de relación en tablas existentes que no rompen filas ya existentes).

- [ ] **Step 5: Verificar que el cliente generado compila**

Run: `npx tsc --noEmit`
Expected: sin errores (el schema no se usa todavía en ningún lado nuevo, pero debe generar tipos válidos).

- [ ] **Step 6: Commit**

```bash
git add prisma/schema.prisma "prisma/migrations/"
git commit -m "Agregar modelo de datos de notificaciones (Notificacion, NotificacionDestinatario, ReglaNotificacion)"
```

---

### Task 2: Lógica pura de notificaciones

**Files:**
- Create: `src/lib/notificaciones.ts`
- Test: `src/lib/notificaciones.test.ts`
- Modify: `package.json`

**Interfaces:**
- Consumes: `TipoNotificacion`, `RoleUsuario` de `@/generated/prisma/enums` (Task 1).
- Produces:
  - `TIPO_NOTIFICACION_LABELS: Record<TipoNotificacion, string>` — labels legibles, usados en Tasks 4, 10, 11.
  - `resolverDestinatarios(reglas: ReglaSimplificada[]): Map<number, { inApp: boolean; correo: boolean }>` — usado en Task 3.
  - `resumenParaRol(resumen: Record<string, unknown>, tipo: TipoNotificacion, role: RoleUsuario): Record<string, unknown>` — usado en Tasks 4, 9.
  - Tipos `ResumenPesajeCompletado`, `ResumenCompraRegistrada`, `ResumenVentaCerrada`, `ResumenVentaRequiereAprobacion` — usados en Tasks 6, 7, 8 al construir el `resumen` que se guarda.

- [ ] **Step 1: Escribir el test que falla primero**

Crear `src/lib/notificaciones.test.ts`:

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { resolverDestinatarios, resumenParaRol } from "./notificaciones";

test("resolverDestinatarios combina canales del mismo usuario con OR (dos reglas, una in-app y otra correo)", () => {
  const resultado = resolverDestinatarios([
    { usuarioId: 1, canalInApp: true, canalCorreo: false },
    { usuarioId: 1, canalInApp: false, canalCorreo: true },
  ]);
  assert.deepEqual(resultado.get(1), { inApp: true, correo: true });
});

test("resolverDestinatarios mantiene usuarios distintos separados", () => {
  const resultado = resolverDestinatarios([
    { usuarioId: 1, canalInApp: true, canalCorreo: false },
    { usuarioId: 2, canalInApp: false, canalCorreo: true },
  ]);
  assert.deepEqual(resultado.get(1), { inApp: true, correo: false });
  assert.deepEqual(resultado.get(2), { inApp: false, correo: true });
});

test("resolverDestinatarios con una lista vacía regresa un mapa vacío", () => {
  const resultado = resolverDestinatarios([]);
  assert.equal(resultado.size, 0);
});

test("resumenParaRol oculta precioUnitarioKg e importeTotal para OPERADOR en COMPRA_REGISTRADA", () => {
  const resumen = { folioTicket: "7654", proveedorNombre: "ITALIKA", netoKg: 980, precioUnitarioKg: 3, importeTotal: 2940 };
  const resultado = resumenParaRol(resumen, "COMPRA_REGISTRADA", "OPERADOR");
  assert.equal("precioUnitarioKg" in resultado, false);
  assert.equal("importeTotal" in resultado, false);
  assert.equal(resultado.folioTicket, "7654");
});

test("resumenParaRol oculta precio en VENTA_CERRADA para OPERADOR pero no para ADMIN", () => {
  const resumen = { clienteNombre: "ABC", pesoReportadoClienteKg: 500, precioUnitarioKg: 2, importeTotal: 1000, diferenciaKg: 0 };
  const paraOperador = resumenParaRol(resumen, "VENTA_CERRADA", "OPERADOR");
  const paraAdmin = resumenParaRol(resumen, "VENTA_CERRADA", "ADMIN");
  assert.equal("precioUnitarioKg" in paraOperador, false);
  assert.equal(paraAdmin.precioUnitarioKg, 2);
});

test("resumenParaRol no quita nada en tipos sin precio (PESAJE_COMPLETADO)", () => {
  const resumen = { folioTicket: "7654", ubicacionNombre: "ITALIKA", proveedorNombre: "ITALIKA", articuloNombre: "CARTON", netoKg: 980 };
  const resultado = resumenParaRol(resumen, "PESAJE_COMPLETADO", "OPERADOR");
  assert.deepEqual(resultado, resumen);
});
```

- [ ] **Step 2: Agregar el archivo nuevo al script de test en `package.json`**

Línea actual:

```json
    "test": "tsx --test src/lib/tolerancia.test.ts src/lib/netsuite.test.ts src/lib/storage.test.ts"
```

Reemplazar por:

```json
    "test": "tsx --test src/lib/tolerancia.test.ts src/lib/netsuite.test.ts src/lib/storage.test.ts src/lib/notificaciones.test.ts"
```

- [ ] **Step 3: Correr el test y confirmar que falla**

Run: `npm test`
Expected: falla al importar `./notificaciones` — el archivo no existe todavía (`Cannot find module`).

- [ ] **Step 4: Crear `src/lib/notificaciones.ts`**

```ts
// Lógica pura, sin dependencias de servidor — importable desde acciones de
// servidor, route handlers y componentes cliente por igual (mismo criterio
// que src/lib/tolerancia.ts). No lleva "server-only": ese import rompe bajo
// tsx --test (ver Global Constraints de este plan).
import type { TipoNotificacion, RoleUsuario } from "@/generated/prisma/enums";

export const TIPO_NOTIFICACION_LABELS: Record<TipoNotificacion, string> = {
  PESAJE_COMPLETADO: "Pesaje completado",
  COMPRA_REGISTRADA: "Compra registrada",
  VENTA_CERRADA: "Venta cerrada",
  VENTA_REQUIERE_APROBACION: "Requiere tu aprobación",
};

export type ResumenPesajeCompletado = {
  folioTicket: string;
  ubicacionNombre: string;
  proveedorNombre: string;
  articuloNombre: string;
  netoKg: number;
};

export type ResumenCompraRegistrada = {
  folioTicket: string;
  proveedorNombre: string;
  netoKg: number;
  precioUnitarioKg: number;
  importeTotal: number;
};

export type ResumenVentaCerrada = {
  clienteNombre: string;
  pesoReportadoClienteKg: number;
  precioUnitarioKg: number;
  importeTotal: number;
  diferenciaKg: number;
};

export type ResumenVentaRequiereAprobacion = {
  clienteNombre: string;
  pesoVendidoKg: number;
  pesoReportadoClienteKg: number;
  diferenciaKg: number;
  umbralPct: number;
};

type ReglaSimplificada = {
  usuarioId: number;
  canalInApp: boolean;
  canalCorreo: boolean;
};

// Agrupa reglas ya filtradas (por tipo + ubicación, el filtro lo hace quien
// llama con la consulta a Prisma) por usuario, combinando canales con OR —
// si cualquiera de las reglas que aplican a ese usuario tiene un canal en
// true, ese canal queda activo para él.
export function resolverDestinatarios(
  reglas: ReglaSimplificada[],
): Map<number, { inApp: boolean; correo: boolean }> {
  const porUsuario = new Map<number, { inApp: boolean; correo: boolean }>();
  for (const r of reglas) {
    const actual = porUsuario.get(r.usuarioId) ?? { inApp: false, correo: false };
    porUsuario.set(r.usuarioId, {
      inApp: actual.inApp || r.canalInApp,
      correo: actual.correo || r.canalCorreo,
    });
  }
  return porUsuario;
}

// Campos que se ocultan si el destinatario es OPERADOR — mismo criterio que
// ya restringe precios en las pantallas de Compras/Ventas para ese rol.
const CAMPOS_PRECIO_POR_TIPO: Partial<Record<TipoNotificacion, string[]>> = {
  COMPRA_REGISTRADA: ["precioUnitarioKg", "importeTotal"],
  VENTA_CERRADA: ["precioUnitarioKg", "importeTotal"],
};

export function resumenParaRol(
  resumen: Record<string, unknown>,
  tipo: TipoNotificacion,
  role: RoleUsuario,
): Record<string, unknown> {
  if (role !== "OPERADOR") return resumen;
  const camposOcultos = CAMPOS_PRECIO_POR_TIPO[tipo];
  if (!camposOcultos) return resumen;
  const filtrado = { ...resumen };
  for (const campo of camposOcultos) delete filtrado[campo];
  return filtrado;
}
```

- [ ] **Step 5: Correr el test y confirmar que pasa**

Run: `npm test`
Expected: los 6 tests nuevos pasan, más los ya existentes de `tolerancia`/`netsuite`/`storage` sin regresión.

- [ ] **Step 6: Verificar tipos y lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: sin errores.

- [ ] **Step 7: Commit**

```bash
git add src/lib/notificaciones.ts src/lib/notificaciones.test.ts package.json
git commit -m "Agregar lógica pura de notificaciones (resolución de destinatarios, filtrado de precio por rol)"
```

---

### Task 3: Creación de notificaciones (helper de servidor)

**Files:**
- Create: `src/lib/notificaciones-server.ts`

**Interfaces:**
- Consumes: `resolverDestinatarios` de `@/lib/notificaciones` (Task 2); `prisma` de `@/lib/db`; `TipoNotificacion` de `@/generated/prisma/enums` (Task 1).
- Produces: `crearNotificacion(data: { tipo: TipoNotificacion; entidad: string; entidadId: number; ubicacionId: number; resumen: Record<string, unknown> }): Promise<void>` — usado en Tasks 6, 7, 8. **Nunca lanza** (atrapa cualquier error y hace `console.error`), para que un fallo de notificación jamás rompa la operación que la disparó.

**Sin test dedicado** (necesita una base de datos real — `prisma.reglaNotificacion.findMany`, `prisma.notificacion.create`, `prisma.notificacionDestinatario.createMany` — mismo criterio que `registrarAuditLog()` en `src/lib/audit.ts`, que tampoco tiene test propio). Se verifica de forma manual e indirecta en las Tasks 6-8, al disparar cada evento real desde el navegador.

- [ ] **Step 1: Crear `src/lib/notificaciones-server.ts`**

```ts
import "server-only";
import { prisma } from "@/lib/db";
import { resolverDestinatarios } from "@/lib/notificaciones";
import type { TipoNotificacion } from "@/generated/prisma/enums";
import type { Prisma } from "@/generated/prisma/client";

// La operación principal (cerrar el pesaje, registrar la compra, cerrar la
// venta) ya tuvo éxito antes de llegar aquí — un fallo al notificar es
// recuperable (se puede reconstruir manualmente si hace falta) mientras que
// revertir una operación exitosa por un fallo de notificación sí sería un
// problema real. Por eso todo el cuerpo va envuelto en un try/catch que
// solo loguea.
export async function crearNotificacion(data: {
  tipo: TipoNotificacion;
  entidad: string;
  entidadId: number;
  ubicacionId: number;
  resumen: Record<string, unknown>;
}): Promise<void> {
  try {
    const reglas = await prisma.reglaNotificacion.findMany({
      where: {
        tipo: data.tipo,
        activo: true,
        OR: [{ ubicacionId: null }, { ubicacionId: data.ubicacionId }],
      },
      select: { usuarioId: true, canalInApp: true, canalCorreo: true },
    });

    // La fila Notificacion se crea siempre, aunque nadie esté suscrito
    // todavía — queda como historial; si luego se agrega una regla, no
    // genera notificaciones retroactivas (ver spec, sección "Resolución de
    // destinatarios").
    const notificacion = await prisma.notificacion.create({
      data: {
        tipo: data.tipo,
        entidad: data.entidad,
        entidadId: data.entidadId,
        ubicacionId: data.ubicacionId,
        resumen: data.resumen as Prisma.InputJsonValue,
      },
    });

    const porUsuario = resolverDestinatarios(reglas);
    const destinatarios = [...porUsuario.entries()].filter(
      ([, canales]) => canales.inApp || canales.correo,
    );
    if (destinatarios.length === 0) return;

    await prisma.notificacionDestinatario.createMany({
      data: destinatarios.map(([usuarioId, canales]) => ({
        notificacionId: notificacion.id,
        usuarioId,
        requiereCorreo: canales.correo,
      })),
    });
  } catch (error) {
    console.error(`[notificaciones] no se pudo crear notificación ${data.tipo}:`, error);
  }
}
```

- [ ] **Step 2: Verificar tipos y lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: sin errores (el archivo no se usa todavía en ningún lado, pero debe compilar solo).

- [ ] **Step 3: Commit**

```bash
git add src/lib/notificaciones-server.ts
git commit -m "Agregar crearNotificacion() — resuelve reglas y registra notificación sin romper la operación que la dispara"
```

---

### Task 4: Plantilla y envío de correo

**Files:**
- Create: `src/lib/notificaciones-email.ts`
- Modify: `src/lib/email.ts`

**Interfaces:**
- Consumes: `resumenParaRol`, `TIPO_NOTIFICACION_LABELS` de `@/lib/notificaciones` (Task 2); `readStoredFile` de `@/lib/storage`; `prisma` de `@/lib/db`; `TipoNotificacion`, `RoleUsuario` de `@/generated/prisma/enums`.
- Produces:
  - `armarCorreoNotificacion(tipo, entidad, entidadId, resumenCompleto, destinatarioRole): Promise<{ subject: string; html: string; attachments: { filename: string; content: Buffer }[] }>` — usado en Task 5.
  - `enviarCorreo(params: { to: string; subject: string; html: string; attachments?: { filename: string; content: Buffer }[] }): Promise<void>` (en `email.ts`) — usado en Task 5.

- [ ] **Step 1: Agregar `enviarCorreo()` a `src/lib/email.ts`**

El archivo completo hoy:

```ts
import "server-only";
import nodemailer from "nodemailer";

const smtpHost = process.env.SMTP_HOST;

// Sin SMTP configurado (ej. desarrollo local), el correo se imprime en la
// consola del servidor en vez de fallar — así el flujo se puede probar
// completo sin depender de credenciales reales.
const transporter = smtpHost
  ? nodemailer.createTransport({
      host: smtpHost,
      port: Number(process.env.SMTP_PORT ?? 587),
      secure: Number(process.env.SMTP_PORT) === 465,
      auth: process.env.SMTP_USER
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
        : undefined,
    })
  : null;

export async function sendPasswordResetEmail(to: string, resetUrl: string) {
  const from = process.env.SMTP_FROM ?? "PROMERC <no-reply@promerc.local>";
  const subject = "Recuperación de contraseña — PROMERC";
  const text = `Solicitaste recuperar tu contraseña. Abre este enlace (válido 1 hora):\n\n${resetUrl}\n\nSi no fuiste tú, ignora este correo.`;

  if (!transporter) {
    console.log(`[email:dev] Para ${to} — ${subject}\n${text}`);
    return;
  }

  await transporter.sendMail({ from, to, subject, text });
}
```

Agregar al final (después de `sendPasswordResetEmail`):

```ts

export async function enviarCorreo(params: {
  to: string;
  subject: string;
  html: string;
  attachments?: { filename: string; content: Buffer }[];
}) {
  const from = process.env.SMTP_FROM ?? "PROMERC <no-reply@promerc.local>";

  if (!transporter) {
    console.log(`[email:dev] Para ${params.to} — ${params.subject}`);
    return;
  }

  await transporter.sendMail({
    from,
    to: params.to,
    subject: params.subject,
    html: params.html,
    attachments: params.attachments,
  });
}
```

- [ ] **Step 2: Crear `src/lib/notificaciones-email.ts`**

```ts
import "server-only";
import { prisma } from "@/lib/db";
import { readStoredFile } from "@/lib/storage";
import { resumenParaRol, TIPO_NOTIFICACION_LABELS } from "@/lib/notificaciones";
import type { TipoNotificacion, RoleUsuario } from "@/generated/prisma/enums";

const RUTA_POR_ENTIDAD: Record<string, string> = {
  Pesaje: "/pesajes",
  Compra: "/compras",
  Venta: "/ventas",
};

// La evidencia relevante depende del tipo de entidad — Compra no tiene
// evidencia propia, hereda la del Pesaje que la originó (ver spec, sección
// "Evidencia adjunta en el correo").
async function resolverEvidenciaAdjunta(entidad: string, entidadId: number) {
  if (entidad === "Pesaje") {
    return prisma.evidencia.findFirst({
      where: { pesajeId: entidadId, tipo: "TICKET_BASCULA" },
      orderBy: { createdAt: "desc" },
    });
  }
  if (entidad === "Compra") {
    const compra = await prisma.compra.findUnique({ where: { id: entidadId } });
    if (!compra) return null;
    return prisma.evidencia.findFirst({
      where: { pesajeId: compra.pesajeId, tipo: "TICKET_BASCULA" },
      orderBy: { createdAt: "desc" },
    });
  }
  if (entidad === "Venta") {
    return prisma.evidencia.findFirst({
      where: { ventaId: entidadId, tipo: "COMPROBANTE_CLIENTE" },
      orderBy: { createdAt: "desc" },
    });
  }
  return null;
}

const ETIQUETAS_CAMPO: Record<string, string> = {
  folioTicket: "Folio",
  ubicacionNombre: "Ubicación",
  proveedorNombre: "Proveedor",
  clienteNombre: "Cliente",
  articuloNombre: "Artículo",
  netoKg: "Neto (kg)",
  pesoVendidoKg: "Peso vendido (kg)",
  pesoReportadoClienteKg: "Peso reportado (kg)",
  diferenciaKg: "Diferencia (kg)",
  umbralPct: "Umbral de tolerancia (%)",
  precioUnitarioKg: "Precio por kg ($)",
  importeTotal: "Importe total ($)",
};

// Mismo orden en el que aparecen en el diccionario de arriba — cada tipo de
// evento solo trae un subconjunto de estas llaves en su resumen.
const ORDEN_CAMPOS = Object.keys(ETIQUETAS_CAMPO);

function tablaResumen(resumen: Record<string, unknown>): string {
  const filas = ORDEN_CAMPOS.filter((campo) => campo in resumen)
    .map(
      (campo) =>
        `<tr><td style="padding:4px 12px 4px 0;color:#666;">${ETIQUETAS_CAMPO[campo]}</td><td style="padding:4px 0;font-weight:600;">${resumen[campo]}</td></tr>`,
    )
    .join("");
  return `<table>${filas}</table>`;
}

export async function armarCorreoNotificacion(
  tipo: TipoNotificacion,
  entidad: string,
  entidadId: number,
  resumenCompleto: Record<string, unknown>,
  destinatarioRole: RoleUsuario,
): Promise<{ subject: string; html: string; attachments: { filename: string; content: Buffer }[] }> {
  const resumen = resumenParaRol(resumenCompleto, tipo, destinatarioRole);
  const titulo = TIPO_NOTIFICACION_LABELS[tipo];
  const referencia = String(resumen.folioTicket ?? resumen.clienteNombre ?? `#${entidadId}`);
  const rutaBase = RUTA_POR_ENTIDAD[entidad] ?? "";
  const appUrl = process.env.APP_URL ?? "http://localhost:3000";

  const html = `
    <div style="font-family:sans-serif;max-width:480px;margin:0 auto;">
      <h2 style="color:#4338ca;">${titulo}</h2>
      ${tablaResumen(resumen)}
      <p style="margin-top:16px;">
        <a href="${appUrl}${rutaBase}/${entidadId}" style="background:#4338ca;color:#fff;padding:10px 16px;border-radius:6px;text-decoration:none;">Ver en PROMERC</a>
      </p>
    </div>
  `;

  const evidencia = await resolverEvidenciaAdjunta(entidad, entidadId);
  const attachments = evidencia
    ? [
        {
          filename: `evidencia.${evidencia.mimeType.split("/")[1] ?? "bin"}`,
          content: await readStoredFile(evidencia.rutaArchivo),
        },
      ]
    : [];

  return { subject: `${titulo} — ${referencia}`, html, attachments };
}
```

- [ ] **Step 3: Verificar tipos y lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: sin errores.

- [ ] **Step 4: Commit**

```bash
git add src/lib/email.ts src/lib/notificaciones-email.ts
git commit -m "Agregar plantilla y envío de correo de notificaciones con evidencia adjunta"
```

---

### Task 5: Cron de envío de correo

**Files:**
- Create: `src/app/api/cron/notificaciones/route.ts`
- Modify: `.env.production.example`

**Interfaces:**
- Consumes: `armarCorreoNotificacion` de `@/lib/notificaciones-email` (Task 4); `enviarCorreo` de `@/lib/email` (Task 4); `prisma` de `@/lib/db`.
- Produces: `POST /api/cron/notificaciones` — protegido por header `x-cron-secret` contra `process.env.CRON_SECRET`. Procesa hasta 50 destinatarios pendientes por corrida, máximo 5 intentos cada uno.

- [ ] **Step 1: Crear `src/app/api/cron/notificaciones/route.ts`**

```ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { armarCorreoNotificacion } from "@/lib/notificaciones-email";
import { enviarCorreo } from "@/lib/email";

const LIMITE_INTENTOS = 5;
const TAMANO_LOTE = 50;

export async function POST(request: Request) {
  const secret = request.headers.get("x-cron-secret");
  if (!secret || !process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const pendientes = await prisma.notificacionDestinatario.findMany({
    where: {
      requiereCorreo: true,
      correoEnviadoEn: null,
      correoIntentos: { lt: LIMITE_INTENTOS },
    },
    include: { notificacion: true, usuario: true },
    orderBy: { createdAt: "asc" },
    take: TAMANO_LOTE,
  });

  let enviados = 0;
  let fallidos = 0;

  for (const item of pendientes) {
    try {
      const correo = await armarCorreoNotificacion(
        item.notificacion.tipo,
        item.notificacion.entidad,
        item.notificacion.entidadId,
        item.notificacion.resumen as Record<string, unknown>,
        item.usuario.role,
      );
      await enviarCorreo({ to: item.usuario.email, ...correo });
      await prisma.notificacionDestinatario.update({
        where: { id: item.id },
        data: { correoEnviadoEn: new Date() },
      });
      enviados++;
    } catch (error) {
      await prisma.notificacionDestinatario.update({
        where: { id: item.id },
        data: {
          correoIntentos: { increment: 1 },
          correoError: error instanceof Error ? error.message : String(error),
        },
      });
      fallidos++;
    }
  }

  return NextResponse.json({ revisados: pendientes.length, enviados, fallidos });
}
```

- [ ] **Step 2: Documentar `CRON_SECRET` en `.env.production.example`**

Agregar, después del bloque de `NETSUITE_SUBSIDIARY_ID` y antes del comentario de `PORT`:

```bash

# Secreto compartido para proteger /api/cron/notificaciones — el Cron Job
# de cPanel lo manda como header "x-cron-secret" en cada corrida. Generar
# igual que SESSION_SECRET:
#   openssl rand -base64 32
CRON_SECRET="GENERAR_CON_openssl_rand_-base64_32"
```

- [ ] **Step 3: Verificar tipos y lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: sin errores.

- [ ] **Step 4: Verificación manual**

Con el servidor de dev corriendo (`npm run dev`) y sin `CRON_SECRET` configurado en `.env` local:

```bash
curl -i -X POST http://localhost:3000/api/cron/notificaciones -H "x-cron-secret: cualquier-cosa"
```

Expected: `401` (`CRON_SECRET` no está configurado en el entorno local, así que ninguna comparación pasa). Agregar temporalmente `CRON_SECRET=test123` a `.env`, reiniciar el dev server, y repetir con `-H "x-cron-secret: test123"` — expected: `200` con `{"revisados":0,"enviados":0,"fallidos":0}` (todavía no hay notificaciones creadas, eso llega en las Tasks 6-8).

- [ ] **Step 5: Commit**

```bash
git add "src/app/api/cron/notificaciones/route.ts" .env.production.example
git commit -m "Agregar cron de envío de correo de notificaciones"
```

---

### Task 6: Disparo en Pesaje completado

**Files:**
- Modify: `src/app/(app)/pesajes/[id]/actions.ts`

**Interfaces:**
- Consumes: `crearNotificacion` de `@/lib/notificaciones-server` (Task 3); `ResumenPesajeCompletado` de `@/lib/notificaciones` (Task 2).
- Produces: notificación `PESAJE_COMPLETADO` cada vez que `cerrarPesaje` completa un pesaje.

- [ ] **Step 1: Agregar el import**

Al inicio del archivo, donde ya están los demás imports:

```ts
import { saveUpload, saveDataUrl } from "@/lib/storage";
```

Agregar justo debajo:

```ts
import { crearNotificacion } from "@/lib/notificaciones-server";
import type { ResumenPesajeCompletado } from "@/lib/notificaciones";
```

- [ ] **Step 2: Incluir las relaciones necesarias para el resumen**

En `cerrarPesaje`, la consulta inicial hoy es:

```ts
  const id = Number(formData.get("id"));
  const pesaje = await prisma.pesaje.findUnique({ where: { id } });
```

Reemplazar por:

```ts
  const id = Number(formData.get("id"));
  const pesaje = await prisma.pesaje.findUnique({
    where: { id },
    include: { proveedor: true, articulo: true, ubicacion: true },
  });
```

- [ ] **Step 3: Disparar la notificación después de la transacción exitosa**

El final de `cerrarPesaje` hoy:

```ts
  await prisma.$transaction([
    prisma.pesaje.update({
      where: { id },
      data: {
        grossKg: validated.data.grossKg,
        netoKg,
        netoCapturadoEn,
        pesadorNombre: validated.data.pesadorNombre,
        observaciones: validated.data.observaciones || null,
        estado: "COMPLETO",
        loteId: lote.id,
      },
    }),
    prisma.evidencia.create({
      data: {
        pesajeId: id,
        tipo: "TICKET_BASCULA",
        rutaArchivo: fotoGuardada.rutaArchivo,
        mimeType: fotoGuardada.mimeType,
        tamanoBytes: fotoGuardada.tamanoBytes,
        subidoPorUsuarioId: usuario.id,
      },
    }),
  ]);

  revalidatePath(`/pesajes/${id}`);
  revalidatePath("/pesajes");
  redirect(`/pesajes/${id}`);
}
```

Reemplazar por (agrega el bloque `resumen` + `crearNotificacion` entre el `$transaction` y los `revalidatePath`):

```ts
  await prisma.$transaction([
    prisma.pesaje.update({
      where: { id },
      data: {
        grossKg: validated.data.grossKg,
        netoKg,
        netoCapturadoEn,
        pesadorNombre: validated.data.pesadorNombre,
        observaciones: validated.data.observaciones || null,
        estado: "COMPLETO",
        loteId: lote.id,
      },
    }),
    prisma.evidencia.create({
      data: {
        pesajeId: id,
        tipo: "TICKET_BASCULA",
        rutaArchivo: fotoGuardada.rutaArchivo,
        mimeType: fotoGuardada.mimeType,
        tamanoBytes: fotoGuardada.tamanoBytes,
        subidoPorUsuarioId: usuario.id,
      },
    }),
  ]);

  const resumen: ResumenPesajeCompletado = {
    folioTicket: pesaje.folioTicket,
    ubicacionNombre: pesaje.ubicacion.nombre,
    proveedorNombre: pesaje.proveedor.nombre,
    articuloNombre: pesaje.articulo?.nombre ?? "—",
    netoKg,
  };
  await crearNotificacion({
    tipo: "PESAJE_COMPLETADO",
    entidad: "Pesaje",
    entidadId: id,
    ubicacionId: pesaje.ubicacionId,
    resumen,
  });

  revalidatePath(`/pesajes/${id}`);
  revalidatePath("/pesajes");
  redirect(`/pesajes/${id}`);
}
```

- [ ] **Step 4: Verificar tipos y lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: sin errores.

- [ ] **Step 5: Verificación manual**

Con el servidor de dev corriendo y sesión de `admin@promerc.local`:

1. En `psql` local, crea una regla de prueba para que el propio admin reciba `PESAJE_COMPLETADO`:
   ```sql
   INSERT INTO "ReglaNotificacion" (tipo, "usuarioId", "ubicacionId", "canalInApp", "canalCorreo", activo, "createdAt")
   VALUES ('PESAJE_COMPLETADO', (SELECT id FROM "Usuario" WHERE email = 'admin@promerc.local'), NULL, true, true, true, now());
   ```
2. Completa un ciclo de pesaje (tara → registrar salida → cerrar en báscula) desde la UI.
3. En `psql`, confirma que se crearon las filas:
   ```sql
   SELECT * FROM "Notificacion" ORDER BY id DESC LIMIT 1;
   SELECT * FROM "NotificacionDestinatario" ORDER BY id DESC LIMIT 1;
   ```
   Expected: una fila en cada tabla, `requiereCorreo = true`, `correoEnviadoEn` todavía `NULL` (el cron de la Task 5 es quien lo manda, no esta acción).

- [ ] **Step 6: Commit**

```bash
git add "src/app/(app)/pesajes/[id]/actions.ts"
git commit -m "Disparar notificación PESAJE_COMPLETADO al cerrar un pesaje en báscula"
```

---

### Task 7: Disparo en Compra registrada

**Files:**
- Modify: `src/app/(app)/compras/nuevo/[pesajeId]/actions.ts`

**Interfaces:**
- Consumes: `crearNotificacion` de `@/lib/notificaciones-server` (Task 3); `ResumenCompraRegistrada` de `@/lib/notificaciones` (Task 2).
- Produces: notificación `COMPRA_REGISTRADA` cada vez que se crea una Compra.

- [ ] **Step 1: Agregar los imports**

El archivo completo hoy:

```ts
"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireRole, canAccessUbicacion } from "@/lib/auth/dal";
import { actualizarEstadoLote } from "@/lib/lote";
import { crearCompraSchema } from "@/lib/validations/compras";
import type { CatalogFormState } from "@/components/catalog-form";
```

Agregar después de `crearCompraSchema`:

```ts
import { crearNotificacion } from "@/lib/notificaciones-server";
import type { ResumenCompraRegistrada } from "@/lib/notificaciones";
```

- [ ] **Step 2: Incluir la relación `proveedor` en la consulta del pesaje**

Línea actual:

```ts
  const pesaje = await prisma.pesaje.findUnique({
    where: { id: pesajeId },
    include: { compra: true },
  });
```

Reemplazar por:

```ts
  const pesaje = await prisma.pesaje.findUnique({
    where: { id: pesajeId },
    include: { compra: true, proveedor: true },
  });
```

- [ ] **Step 3: Disparar la notificación después de crear la compra**

El final de la función hoy:

```ts
  const compra = await prisma.compra.create({
    data: {
      pesajeId: pesaje.id,
      ubicacionId: pesaje.ubicacionId,
      proveedorId: pesaje.proveedorId,
      loteId: pesaje.loteId,
      precioUnitarioKg: validated.data.precioUnitarioKg,
      importeTotal,
      fechaOperacion,
    },
  });

  await actualizarEstadoLote(pesaje.loteId);

  redirect(`/compras/${compra.id}`);
}
```

Reemplazar por:

```ts
  const compra = await prisma.compra.create({
    data: {
      pesajeId: pesaje.id,
      ubicacionId: pesaje.ubicacionId,
      proveedorId: pesaje.proveedorId,
      loteId: pesaje.loteId,
      precioUnitarioKg: validated.data.precioUnitarioKg,
      importeTotal,
      fechaOperacion,
    },
  });

  await actualizarEstadoLote(pesaje.loteId);

  const resumen: ResumenCompraRegistrada = {
    folioTicket: pesaje.folioTicket,
    proveedorNombre: pesaje.proveedor.nombre,
    netoKg,
    precioUnitarioKg: validated.data.precioUnitarioKg,
    importeTotal,
  };
  await crearNotificacion({
    tipo: "COMPRA_REGISTRADA",
    entidad: "Compra",
    entidadId: compra.id,
    ubicacionId: pesaje.ubicacionId,
    resumen,
  });

  redirect(`/compras/${compra.id}`);
}
```

- [ ] **Step 4: Verificar tipos y lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: sin errores.

- [ ] **Step 5: Verificación manual**

Igual que la Task 6: inserta una `ReglaNotificacion` para `COMPRA_REGISTRADA`, registra una compra desde un pesaje completo en la UI, confirma en `psql` que aparecen las filas nuevas en `Notificacion`/`NotificacionDestinatario` con `resumen` conteniendo `precioUnitarioKg`/`importeTotal`.

- [ ] **Step 6: Commit**

```bash
git add "src/app/(app)/compras/nuevo/[pesajeId]/actions.ts"
git commit -m "Disparar notificación COMPRA_REGISTRADA al registrar una compra"
```

---

### Task 8: Disparo en Venta cerrada / requiere aprobación

**Files:**
- Modify: `src/app/(app)/ventas/[id]/actions.ts`

**Interfaces:**
- Consumes: `crearNotificacion` de `@/lib/notificaciones-server` (Task 3); `ResumenVentaCerrada`, `ResumenVentaRequiereAprobacion` de `@/lib/notificaciones` (Task 2).
- Produces: notificación `VENTA_CERRADA` (venta cierra directo sin exceder tolerancia, o se aprueba una excepción) y `VENTA_REQUIERE_APROBACION` (cae en `PENDIENTE_APROBACION`).

- [ ] **Step 1: Agregar los imports**

Al inicio del archivo, donde ya están los demás imports:

```ts
import { crearOrdenVenta } from "@/lib/netsuite";
```

Agregar justo debajo:

```ts
import { crearNotificacion } from "@/lib/notificaciones-server";
import type { ResumenVentaCerrada, ResumenVentaRequiereAprobacion } from "@/lib/notificaciones";
```

- [ ] **Step 2: Incluir la relación `cliente` en `reportarPesoVenta`**

Línea actual, dentro de `reportarPesoVenta`:

```ts
  const id = Number(formData.get("id"));
  const venta = await prisma.venta.findUnique({ where: { id } });
```

Reemplazar por:

```ts
  const id = Number(formData.get("id"));
  const venta = await prisma.venta.findUnique({ where: { id }, include: { cliente: true } });
```

- [ ] **Step 3: Disparar la notificación al final de `reportarPesoVenta`**

El final de la función hoy:

```ts
  await prisma.$transaction(operaciones);

  revalidatePath(`/ventas/${id}`);
  revalidatePath("/ventas");
  redirect(`/ventas/${id}`);
}

export async function corregirVenta(
```

Reemplazar por:

```ts
  await prisma.$transaction(operaciones);

  if (excede) {
    const resumen: ResumenVentaRequiereAprobacion = {
      clienteNombre: venta.cliente.nombre,
      pesoVendidoKg: Number(venta.pesoVendidoKg),
      pesoReportadoClienteKg,
      diferenciaKg,
      umbralPct: umbral,
    };
    await crearNotificacion({
      tipo: "VENTA_REQUIERE_APROBACION",
      entidad: "Venta",
      entidadId: id,
      ubicacionId: venta.ubicacionId,
      resumen,
    });
  } else {
    const resumen: ResumenVentaCerrada = {
      clienteNombre: venta.cliente.nombre,
      pesoReportadoClienteKg,
      precioUnitarioKg: Number(venta.precioUnitarioKg),
      importeTotal,
      diferenciaKg,
    };
    await crearNotificacion({
      tipo: "VENTA_CERRADA",
      entidad: "Venta",
      entidadId: id,
      ubicacionId: venta.ubicacionId,
      resumen,
    });
  }

  revalidatePath(`/ventas/${id}`);
  revalidatePath("/ventas");
  redirect(`/ventas/${id}`);
}

export async function corregirVenta(
```

- [ ] **Step 4: Incluir la relación `cliente` en `aprobarExcepcionTolerancia`**

Línea actual, dentro de `aprobarExcepcionTolerancia`:

```ts
  const id = Number(formData.get("id"));
  const venta = await prisma.venta.findUnique({ where: { id } });
  if (!venta) return { message: "Venta no encontrada." };
  if (venta.estado !== "PENDIENTE_APROBACION") {
    return { message: "Esta venta no tiene una excepción de tolerancia pendiente." };
  }
```

Reemplazar por:

```ts
  const id = Number(formData.get("id"));
  const venta = await prisma.venta.findUnique({ where: { id }, include: { cliente: true } });
  if (!venta) return { message: "Venta no encontrada." };
  if (venta.estado !== "PENDIENTE_APROBACION") {
    return { message: "Esta venta no tiene una excepción de tolerancia pendiente." };
  }
```

- [ ] **Step 5: Disparar `VENTA_CERRADA` al aprobar la excepción**

El final de `aprobarExcepcionTolerancia` hoy:

```ts
  await registrarAuditLog({
    entidad: "Venta",
    entidadId: id,
    accion: "TOLERANCIA_APROBADA",
    usuarioId: usuario.id,
    detalleAnterior: { estado: "PENDIENTE_APROBACION" },
    detalleNuevo: { estado: "CERRADA" },
    motivo: validated.data.justificacion,
  });

  revalidatePath(`/ventas/${id}`);
  revalidatePath("/ventas");
  redirect(`/ventas/${id}`);
}

export async function enviarVentaANetSuite(
```

Reemplazar por:

```ts
  await registrarAuditLog({
    entidad: "Venta",
    entidadId: id,
    accion: "TOLERANCIA_APROBADA",
    usuarioId: usuario.id,
    detalleAnterior: { estado: "PENDIENTE_APROBACION" },
    detalleNuevo: { estado: "CERRADA" },
    motivo: validated.data.justificacion,
  });

  const resumen: ResumenVentaCerrada = {
    clienteNombre: venta.cliente.nombre,
    pesoReportadoClienteKg: Number(venta.pesoReportadoClienteKg ?? 0),
    precioUnitarioKg: Number(venta.precioUnitarioKg),
    importeTotal: Number(venta.importeTotal),
    diferenciaKg: Number(venta.diferenciaKg),
  };
  await crearNotificacion({
    tipo: "VENTA_CERRADA",
    entidad: "Venta",
    entidadId: id,
    ubicacionId: venta.ubicacionId,
    resumen,
  });

  revalidatePath(`/ventas/${id}`);
  revalidatePath("/ventas");
  redirect(`/ventas/${id}`);
}

export async function enviarVentaANetSuite(
```

- [ ] **Step 6: Verificar tipos y lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: sin errores.

- [ ] **Step 7: Verificación manual**

Con reglas de prueba para `VENTA_CERRADA` y `VENTA_REQUIERE_APROBACION` insertadas (igual patrón SQL que la Task 6):

1. Reporta el peso de una venta **sin** diferencia relevante (dentro de tolerancia) → confirma en `psql` que se creó una `Notificacion` tipo `VENTA_CERRADA`.
2. Reporta el peso de otra venta **con** una diferencia que exceda el umbral configurado → confirma que se creó una `Notificacion` tipo `VENTA_REQUIERE_APROBACION`, y que la venta queda en `PENDIENTE_APROBACION`.
3. Aprueba esa excepción desde la UI → confirma que se crea una **segunda** notificación, ahora `VENTA_CERRADA`, para la misma venta.

- [ ] **Step 8: Commit**

```bash
git add "src/app/(app)/ventas/[id]/actions.ts"
git commit -m "Disparar notificaciones VENTA_CERRADA y VENTA_REQUIERE_APROBACION"
```

---

### Task 9: Endpoints de la campanita

**Files:**
- Create: `src/app/api/notificaciones/route.ts`
- Create: `src/app/api/notificaciones/[id]/leer/route.ts`
- Create: `src/app/api/notificaciones/leer-todas/route.ts`

**Interfaces:**
- Consumes: `getCurrentUser` de `@/lib/auth/dal`; `prisma` de `@/lib/db`; `resumenParaRol` de `@/lib/notificaciones` (Task 2); `rutaRegistro` de `@/lib/audit` (ya existente, del visor de auditoría).
- Produces:
  - `GET /api/notificaciones` → `{ noLeidas: number, items: { id, tipo, leidoEn, createdAt, resumen, ruta }[] }`.
  - `POST /api/notificaciones/[id]/leer` → marca una notificación leída (solo si pertenece al usuario actual).
  - `POST /api/notificaciones/leer-todas` → marca todas las del usuario actual.

Usado en Task 10.

- [ ] **Step 1: Crear `src/app/api/notificaciones/route.ts`**

```ts
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/dal";
import { prisma } from "@/lib/db";
import { resumenParaRol } from "@/lib/notificaciones";
import { rutaRegistro } from "@/lib/audit";

const DIAS_HISTORIAL = 30;
const LIMITE_ITEMS = 30;

export async function GET() {
  const usuario = await getCurrentUser();
  const desde = new Date(Date.now() - DIAS_HISTORIAL * 24 * 60 * 60 * 1000);

  const [items, noLeidas] = await Promise.all([
    prisma.notificacionDestinatario.findMany({
      where: { usuarioId: usuario.id, createdAt: { gte: desde } },
      include: { notificacion: true },
      orderBy: { createdAt: "desc" },
      take: LIMITE_ITEMS,
    }),
    prisma.notificacionDestinatario.count({
      where: { usuarioId: usuario.id, leidoEn: null },
    }),
  ]);

  return NextResponse.json({
    noLeidas,
    items: items.map((d) => ({
      id: d.id,
      tipo: d.notificacion.tipo,
      leidoEn: d.leidoEn,
      createdAt: d.notificacion.createdAt,
      resumen: resumenParaRol(
        d.notificacion.resumen as Record<string, unknown>,
        d.notificacion.tipo,
        usuario.role,
      ),
      ruta: rutaRegistro(d.notificacion.entidad, d.notificacion.entidadId),
    })),
  });
}
```

- [ ] **Step 2: Crear `src/app/api/notificaciones/[id]/leer/route.ts`**

```ts
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/dal";
import { prisma } from "@/lib/db";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const usuario = await getCurrentUser();
  const { id } = await params;

  // updateMany con el filtro de usuarioId incluido, no update({where:{id}})
  // solo — así la validación de pertenencia es atómica: si el id no es de
  // este usuario, no actualiza nada, sin necesitar un findUnique previo.
  await prisma.notificacionDestinatario.updateMany({
    where: { id: Number(id), usuarioId: usuario.id },
    data: { leidoEn: new Date() },
  });

  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 3: Crear `src/app/api/notificaciones/leer-todas/route.ts`**

```ts
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/dal";
import { prisma } from "@/lib/db";

export async function POST() {
  const usuario = await getCurrentUser();
  await prisma.notificacionDestinatario.updateMany({
    where: { usuarioId: usuario.id, leidoEn: null },
    data: { leidoEn: new Date() },
  });
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 4: Verificar tipos y lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: sin errores.

- [ ] **Step 5: Verificación manual**

Con sesión de navegador abierta como `admin@promerc.local` (usa las devtools o `curl` con la cookie de sesión copiada) y al menos una notificación ya creada (de las Tasks 6-8):

```bash
curl -s http://localhost:3000/api/notificaciones -H "Cookie: <cookie de sesión>" | head -c 500
```

Expected: JSON con `noLeidas > 0` y al menos un item, `resumen` sin `precioUnitarioKg`/`importeTotal` si la sesión usada es la de `operador.ecatepec@promerc.local` con una regla de `COMPRA_REGISTRADA`/`VENTA_CERRADA` configurada para él. Prueba también `POST /api/notificaciones/leer-todas` y confirma que una llamada posterior a `GET /api/notificaciones` regresa `noLeidas: 0`.

- [ ] **Step 6: Commit**

```bash
git add "src/app/api/notificaciones/"
git commit -m "Agregar endpoints de campanita (polling, marcar leída, marcar todas)"
```

---

### Task 10: Componente NotificationBell + integración en AppNav

**Files:**
- Create: `src/components/notification-bell.tsx`
- Modify: `src/components/app-nav.tsx`

**Interfaces:**
- Consumes: endpoints de Task 9 (`GET /api/notificaciones`, `POST /api/notificaciones/[id]/leer`, `POST /api/notificaciones/leer-todas`); `TIPO_NOTIFICACION_LABELS` de `@/lib/notificaciones` (Task 2).
- Produces: `<NotificationBell />` — campanita con badge, dropdown, polling cada 45s pausado fuera de foco.

- [ ] **Step 1: Crear `src/components/notification-bell.tsx`**

```tsx
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { TIPO_NOTIFICACION_LABELS } from "@/lib/notificaciones";
import type { TipoNotificacion } from "@/generated/prisma/enums";

const INTERVALO_MS = 45_000;

type NotificacionItem = {
  id: number;
  tipo: TipoNotificacion;
  leidoEn: string | null;
  createdAt: string;
  resumen: Record<string, unknown>;
  ruta: string | null;
};

function resumenTexto(resumen: Record<string, unknown>): string {
  if (resumen.folioTicket) return `Ticket ${resumen.folioTicket}`;
  if (resumen.clienteNombre) return String(resumen.clienteNombre);
  return "";
}

export function NotificationBell() {
  const [noLeidas, setNoLeidas] = useState(0);
  const [items, setItems] = useState<NotificacionItem[]>([]);
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const contenedorRef = useRef<HTMLDivElement>(null);

  const cargar = useCallback(async () => {
    if (document.visibilityState !== "visible") return;
    const res = await fetch("/api/notificaciones");
    if (!res.ok) return;
    const data = await res.json();
    setNoLeidas(data.noLeidas);
    setItems(data.items);
  }, []);

  useEffect(() => {
    cargar();
    const interval = setInterval(cargar, INTERVALO_MS);
    document.addEventListener("visibilitychange", cargar);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", cargar);
    };
  }, [cargar]);

  useEffect(() => {
    function alClicAfuera(e: MouseEvent) {
      if (contenedorRef.current && !contenedorRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", alClicAfuera);
    return () => document.removeEventListener("mousedown", alClicAfuera);
  }, []);

  function marcarLeida(item: NotificacionItem) {
    fetch(`/api/notificaciones/${item.id}/leer`, { method: "POST" });
    setItems((prev) =>
      prev.map((i) => (i.id === item.id ? { ...i, leidoEn: new Date().toISOString() } : i)),
    );
    if (!item.leidoEn) setNoLeidas((n) => Math.max(0, n - 1));
    setOpen(false);
    if (item.ruta) router.push(item.ruta);
  }

  async function marcarTodas() {
    await fetch("/api/notificaciones/leer-todas", { method: "POST" });
    setItems((prev) => prev.map((i) => ({ ...i, leidoEn: i.leidoEn ?? new Date().toISOString() })));
    setNoLeidas(0);
  }

  return (
    <div ref={contenedorRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Notificaciones"
        className="relative flex h-11 w-11 items-center justify-center rounded-md hover:bg-border/50"
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2}>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M15 17h5l-1.4-1.4A2 2 0 0 1 18 14.2V11a6 6 0 1 0-12 0v3.2c0 .5-.2 1-.6 1.4L4 17h5m6 0v1a3 3 0 1 1-6 0v-1m6 0H9"
          />
        </svg>
        {noLeidas > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-semibold text-white">
            {noLeidas > 9 ? "9+" : noLeidas}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-20 mt-2 w-80 rounded-md border border-border bg-surface shadow-lg">
          <div className="flex items-center justify-between border-b border-border px-3 py-2">
            <span className="text-sm font-medium">Notificaciones</span>
            {noLeidas > 0 && (
              <button
                type="button"
                onClick={marcarTodas}
                className="text-xs text-primary hover:underline"
              >
                Marcar todas como leídas
              </button>
            )}
          </div>
          <div className="max-h-96 overflow-y-auto">
            {items.length === 0 && (
              <p className="p-4 text-center text-sm text-muted">Sin notificaciones.</p>
            )}
            {items.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => marcarLeida(item)}
                className={`flex w-full flex-col items-start gap-0.5 border-b border-border px-3 py-2 text-left text-sm hover:bg-border/30 ${
                  item.leidoEn ? "" : "bg-primary/5"
                }`}
              >
                <span className="font-medium">{TIPO_NOTIFICACION_LABELS[item.tipo]}</span>
                <span className="text-xs text-muted">{resumenTexto(item.resumen)}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Integrar en `src/components/app-nav.tsx`**

Agregar el import junto a los demás:

```tsx
import { buttonClass } from "@/components/ui/button";
```

Agregar debajo:

```tsx
import { NotificationBell } from "@/components/notification-bell";
```

El bloque desktop hoy:

```tsx
        <div className="hidden items-center gap-3 sm:flex">
          {usuarioRole !== "CLIENTE" && <BuscarForm />}
          <span className="text-sm text-muted">
            {usuarioNombre} · {usuarioRole}
          </span>
          <UbicacionChip ubicacion={usuarioUbicacion} />
          <form action={logoutAction}>
            <button type="submit" className={buttonClass("secondary", "sm")}>
              Salir
            </button>
          </form>
        </div>
```

Reemplazar por:

```tsx
        <div className="hidden items-center gap-3 sm:flex">
          {usuarioRole !== "CLIENTE" && <BuscarForm />}
          {usuarioRole !== "CLIENTE" && <NotificationBell />}
          <span className="text-sm text-muted">
            {usuarioNombre} · {usuarioRole}
          </span>
          <UbicacionChip ubicacion={usuarioUbicacion} />
          <form action={logoutAction}>
            <button type="submit" className={buttonClass("secondary", "sm")}>
              Salir
            </button>
          </form>
        </div>
```

El bloque móvil hoy:

```tsx
          {usuarioRole !== "CLIENTE" && (
            <BuscarForm className="mt-3 border-t border-border pt-3" />
          )}
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted">
                {usuarioNombre} · {usuarioRole}
              </span>
              <UbicacionChip ubicacion={usuarioUbicacion} />
            </div>
            <form action={logoutAction}>
              <button type="submit" className={buttonClass("secondary", "sm")}>
                Salir
              </button>
            </form>
          </div>
```

Reemplazar por:

```tsx
          {usuarioRole !== "CLIENTE" && (
            <BuscarForm className="mt-3 border-t border-border pt-3" />
          )}
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
            <div className="flex items-center gap-2">
              {usuarioRole !== "CLIENTE" && <NotificationBell />}
              <span className="text-sm text-muted">
                {usuarioNombre} · {usuarioRole}
              </span>
              <UbicacionChip ubicacion={usuarioUbicacion} />
            </div>
            <form action={logoutAction}>
              <button type="submit" className={buttonClass("secondary", "sm")}>
                Salir
              </button>
            </form>
          </div>
```

- [ ] **Step 3: Verificar tipos y lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: sin errores.

- [ ] **Step 4: Verificación manual en el navegador**

Con el servidor de dev corriendo y al menos una notificación ya creada para `admin@promerc.local` (de las Tasks 6-8):

1. Entra como `admin@promerc.local`, confirma que aparece la campanita con el badge de no leídas.
2. Ábrela, confirma que lista las notificaciones con título y resumen correctos.
3. Haz clic en una — confirma que navega a la entidad correcta y el badge baja en uno.
4. Con más de una no leída, prueba "Marcar todas como leídas" — confirma que el badge llega a 0 y desaparece.
5. Cambia de pestaña por unos segundos y vuelve — confirma en la pestaña de Red (Network) del navegador que no hubo llamadas a `/api/notificaciones` mientras estuvo en segundo plano, y que hay una nueva justo al volver.
6. Entra como `cliente` si existe una cuenta de portal (rol `CLIENTE`) — confirma que la campanita NO aparece.

- [ ] **Step 5: Commit**

```bash
git add src/components/notification-bell.tsx src/components/app-nav.tsx
git commit -m "Agregar campanita de notificaciones en el nav (polling cada 45s)"
```

---

### Task 11: Pantalla de administración de reglas

**Files:**
- Modify: `src/lib/validations/catalogos.ts`
- Create: `src/app/(app)/catalogos/notificaciones/page.tsx`
- Create: `src/app/(app)/catalogos/notificaciones/actions.ts`
- Create: `src/app/(app)/catalogos/notificaciones/[id]/page.tsx`
- Modify: `src/app/(app)/catalogos/page.tsx`

**Interfaces:**
- Consumes: `TIPO_NOTIFICACION_LABELS` de `@/lib/notificaciones` (Task 2); `CatalogForm`, `CatalogTable` ya existentes; `TipoNotificacion` de `@/generated/prisma/enums` (Task 1).
- Produces: ruta `/catalogos/notificaciones` (solo `ADMIN`) — CRUD de `ReglaNotificacion`.

- [ ] **Step 1: Agregar `reglaNotificacionSchema` a `src/lib/validations/catalogos.ts`**

El archivo hoy empieza así:

```ts
import * as z from "zod";
import { RoleUsuario } from "@/generated/prisma/enums";
```

Reemplazar por:

```ts
import * as z from "zod";
import { RoleUsuario, TipoNotificacion } from "@/generated/prisma/enums";
```

Agregar al final del archivo (después de `usuarioPasswordSchema`):

```ts

export const reglaNotificacionSchema = z.object({
  tipo: z.enum(Object.values(TipoNotificacion) as [string, ...string[]], {
    error: "Selecciona un tipo de evento.",
  }),
  usuarioId: z.string().min(1, { error: "Selecciona un usuario." }),
  ubicacionId: z.string().nullish(),
  canalInApp: z.enum(["true", "false"], { error: "Selecciona una opción." }),
  canalCorreo: z.enum(["true", "false"], { error: "Selecciona una opción." }),
});
```

- [ ] **Step 2: Crear `src/app/(app)/catalogos/notificaciones/actions.ts`**

```ts
"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth/dal";
import { reglaNotificacionSchema } from "@/lib/validations/catalogos";
import type { CatalogFormState } from "@/components/catalog-form";

export async function saveReglaNotificacion(
  _state: CatalogFormState,
  formData: FormData,
): Promise<CatalogFormState> {
  await requireRole(["ADMIN"]);

  const validated = reglaNotificacionSchema.safeParse({
    tipo: formData.get("tipo"),
    usuarioId: formData.get("usuarioId"),
    ubicacionId: formData.get("ubicacionId"),
    canalInApp: formData.get("canalInApp"),
    canalCorreo: formData.get("canalCorreo"),
  });
  if (!validated.success) {
    return { errors: validated.error.flatten().fieldErrors };
  }

  const usuarioId = Number(validated.data.usuarioId);
  // Mismo criterio que el cast de "role" en usuarios/actions.ts: el schema
  // ya validó que es uno de los 4 valores del enum, zod solo lo tipa como
  // string genérico.
  const tipo = validated.data.tipo as
    | "PESAJE_COMPLETADO"
    | "COMPRA_REGISTRADA"
    | "VENTA_CERRADA"
    | "VENTA_REQUIERE_APROBACION";

  // Solo ADMIN/SUPERVISOR pueden aprobar una excepción de tolerancia
  // (aprobarExcepcionTolerancia en ventas/[id]/actions.ts ya exige ese rol)
  // — configurar aquí a alguien más sería una regla que nunca sirve.
  if (tipo === "VENTA_REQUIERE_APROBACION") {
    const destinatario = await prisma.usuario.findUnique({ where: { id: usuarioId } });
    if (!destinatario || (destinatario.role !== "ADMIN" && destinatario.role !== "SUPERVISOR")) {
      return {
        errors: {
          usuarioId: [
            "Solo un ADMIN o SUPERVISOR puede recibir esta notificación — son los únicos que pueden aprobar.",
          ],
        },
      };
    }
  }

  const data = {
    tipo,
    usuarioId,
    ubicacionId: validated.data.ubicacionId ? Number(validated.data.ubicacionId) : null,
    canalInApp: validated.data.canalInApp === "true",
    canalCorreo: validated.data.canalCorreo === "true",
  };

  const id = formData.get("id");
  if (id) {
    await prisma.reglaNotificacion.update({ where: { id: Number(id) }, data });
  } else {
    await prisma.reglaNotificacion.create({ data });
  }

  revalidatePath("/catalogos/notificaciones");
  redirect("/catalogos/notificaciones");
}

export async function toggleReglaNotificacionActivo(formData: FormData) {
  await requireRole(["ADMIN"]);
  await prisma.reglaNotificacion.update({
    where: { id: Number(formData.get("id")) },
    data: { activo: formData.get("activo") === "true" },
  });
  revalidatePath("/catalogos/notificaciones");
}
```

- [ ] **Step 3: Crear `src/app/(app)/catalogos/notificaciones/page.tsx`**

```tsx
import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/dal";
import { prisma } from "@/lib/db";
import { CatalogTable } from "@/components/catalog-table";
import { PageHeader } from "@/components/ui/card";
import { buttonClass } from "@/components/ui/button";
import { TIPO_NOTIFICACION_LABELS } from "@/lib/notificaciones";
import { toggleReglaNotificacionActivo } from "./actions";

export default async function NotificacionesCatalogoPage() {
  const usuario = await getCurrentUser();
  if (usuario.role !== "ADMIN") redirect("/catalogos");

  const reglas = await prisma.reglaNotificacion.findMany({
    include: { usuario: true, ubicacion: true },
    orderBy: [{ tipo: "asc" }, { id: "asc" }],
  });

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Notificaciones"
        action={
          <Link href="/catalogos/notificaciones/nuevo" className={buttonClass("primary", "sm")}>
            Nueva regla
          </Link>
        }
      />
      <p className="text-sm text-muted">
        Quién recibe la campanita y/o el correo cuando se completa un
        pesaje, se registra una compra, o se cierra/requiere aprobación una
        venta.
      </p>
      <CatalogTable
        rows={reglas}
        toggleAction={toggleReglaNotificacionActivo}
        editBasePath="/catalogos/notificaciones"
        columns={[
          { header: "Tipo", cell: (r) => TIPO_NOTIFICACION_LABELS[r.tipo] },
          { header: "Usuario", cell: (r) => r.usuario.nombre },
          { header: "Ubicación", cell: (r) => r.ubicacion?.nombre ?? "Todas" },
          { header: "In-app", cell: (r) => (r.canalInApp ? "Sí" : "No") },
          { header: "Correo", cell: (r) => (r.canalCorreo ? "Sí" : "No") },
        ]}
      />
    </div>
  );
}
```

- [ ] **Step 4: Crear `src/app/(app)/catalogos/notificaciones/[id]/page.tsx`**

```tsx
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/dal";
import { prisma } from "@/lib/db";
import { CatalogForm } from "@/components/catalog-form";
import { TIPO_NOTIFICACION_LABELS } from "@/lib/notificaciones";
import { saveReglaNotificacion } from "../actions";

export default async function ReglaNotificacionFormPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const usuario = await getCurrentUser();
  if (usuario.role !== "ADMIN") redirect("/catalogos");

  const { id } = await params;
  const isNew = id === "nuevo";

  const [regla, usuarios, ubicaciones] = await Promise.all([
    isNew ? null : prisma.reglaNotificacion.findUnique({ where: { id: Number(id) } }),
    prisma.usuario.findMany({
      where: { activo: true, role: { not: "CLIENTE" } },
      orderBy: { nombre: "asc" },
    }),
    prisma.ubicacion.findMany({ where: { activo: true }, orderBy: { nombre: "asc" } }),
  ]);

  if (!isNew && !regla) notFound();

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">
        {isNew ? "Nueva regla de notificación" : "Editar regla de notificación"}
      </h1>
      <CatalogForm
        action={saveReglaNotificacion}
        submitLabel={isNew ? "Crear" : "Guardar"}
        hiddenId={regla?.id}
        defaultValues={
          regla
            ? {
                tipo: regla.tipo,
                usuarioId: regla.usuarioId.toString(),
                ubicacionId: regla.ubicacionId?.toString() ?? "",
                canalInApp: regla.canalInApp.toString(),
                canalCorreo: regla.canalCorreo.toString(),
              }
            : { canalInApp: "true", canalCorreo: "false" }
        }
        fields={[
          {
            name: "tipo",
            label: "Tipo de evento",
            type: "select",
            required: true,
            options: Object.entries(TIPO_NOTIFICACION_LABELS).map(([value, label]) => ({
              value,
              label,
            })),
          },
          {
            name: "usuarioId",
            label: "Usuario",
            type: "select",
            required: true,
            options: usuarios.map((u) => ({ value: u.id.toString(), label: u.nombre })),
          },
          {
            name: "ubicacionId",
            label: "Ubicación",
            type: "select",
            options: [
              { value: "", label: "Todas" },
              ...ubicaciones.map((u) => ({ value: u.id.toString(), label: u.nombre })),
            ],
            helpText: "Deja \"Todas\" para que aplique sin importar la sede de la operación.",
          },
          {
            name: "canalInApp",
            label: "Notificación in-app",
            type: "select",
            required: true,
            options: [
              { value: "true", label: "Sí" },
              { value: "false", label: "No" },
            ],
          },
          {
            name: "canalCorreo",
            label: "Correo",
            type: "select",
            required: true,
            options: [
              { value: "true", label: "Sí" },
              { value: "false", label: "No" },
            ],
          },
        ]}
      />
    </div>
  );
}
```

**Nota:** el campo `ubicacionId` usa `type: "select"` con una opción vacía manual `{ value: "", label: "Todas" }` en vez de depender de la opción "—" que `CatalogForm` ya agrega sola — así el label es explícito ("Todas" en vez de "—"), sin cambiar el componente compartido.

- [ ] **Step 5: Agregar el link en el hub de catálogos**

`src/app/(app)/catalogos/page.tsx` hoy:

```tsx
const catalogos = [
  { href: "/catalogos/ubicaciones", label: "Ubicaciones" },
  { href: "/catalogos/proveedores", label: "Proveedores" },
  { href: "/catalogos/clientes", label: "Clientes" },
  { href: "/catalogos/articulos", label: "Artículos" },
  { href: "/catalogos/unidades-empaque", label: "Unidades de empaque" },
  { href: "/catalogos/usuarios", label: "Usuarios" },
  { href: "/catalogos/tolerancia", label: "Tolerancia" },
  { href: "/catalogos/centro-aprobacion", label: "Centro de Aprobación (NetSuite)" },
];
```

Reemplazar por:

```tsx
const catalogos = [
  { href: "/catalogos/ubicaciones", label: "Ubicaciones" },
  { href: "/catalogos/proveedores", label: "Proveedores" },
  { href: "/catalogos/clientes", label: "Clientes" },
  { href: "/catalogos/articulos", label: "Artículos" },
  { href: "/catalogos/unidades-empaque", label: "Unidades de empaque" },
  { href: "/catalogos/usuarios", label: "Usuarios" },
  { href: "/catalogos/tolerancia", label: "Tolerancia" },
  { href: "/catalogos/centro-aprobacion", label: "Centro de Aprobación (NetSuite)" },
  { href: "/catalogos/notificaciones", label: "Notificaciones" },
];
```

**Nota:** este hub no filtra por rol (todos los que llegan aquí ya pasaron `requireRole(["ADMIN","SUPERVISOR"])` del layout de `catalogos/`) — un `SUPERVISOR` verá la tarjeta "Notificaciones" en el hub, pero al hacer clic lo regresa aquí mismo (`redirect("/catalogos")` del Step 3/4, mismo patrón que "Usuarios"). No hace falta ocultar la tarjeta para que el comportamiento sea correcto — así ya funciona "Usuarios" hoy.

- [ ] **Step 6: Verificar tipos y lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: sin errores.

- [ ] **Step 7: Verificación manual en el navegador**

Con el servidor de dev corriendo:

1. Entra como `admin@promerc.local`, navega a `/catalogos/notificaciones`, confirma que carga vacío o con las reglas de prueba insertadas manualmente en las Tasks 6-8.
2. Crea una regla nueva desde la UI (ej. `PESAJE_COMPLETADO`, usuario operador, ubicación "Todas", ambos canales en "Sí") — confirma que aparece en la tabla.
3. Intenta crear una regla `VENTA_REQUIERE_APROBACION` para un usuario con rol `OPERADOR` — confirma que el formulario regresa el error de validación esperado y NO la crea.
4. Edítala, cambia `canalCorreo` a "No", guarda, confirma que se refleja en la tabla.
5. Desactívala con el botón de la tabla, confirma que pasa a "Inactivo".
6. Entra como `operador.ecatepec@promerc.local`, navega directo a `/catalogos/notificaciones` por URL — debe redirigir a `/catalogos` (por el `redirect` del Step 3).

- [ ] **Step 8: Commit**

```bash
git add src/lib/validations/catalogos.ts "src/app/(app)/catalogos/notificaciones/" "src/app/(app)/catalogos/page.tsx"
git commit -m "Agregar pantalla de administración de reglas de notificación (ADMIN)"
```

---

### Task 12: Documentación de despliegue

**Files:**
- Modify: `DEPLOY.md`

**Interfaces:**
- Consumes: nada de código — solo documenta el paso operativo de configurar el Cron Job en cPanel para que `/api/cron/notificaciones` (Task 5) realmente corra en producción.
- Produces: instrucciones reproducibles para el siguiente despliegue.

- [ ] **Step 1: Agregar la sección del Cron Job**

En `DEPLOY.md`, la sección `## 5. Configurar "Setup Node.js App"` termina así:

```markdown
- **No le des clic a "Run NPM Install"** — `node_modules` ya viene armado y
  compatible dentro de `deploy/`; reinstalar ahí lo pisa con paquetes que
  quizás no coincidan con el entorno de build de Docker.
- Guarda y **Restart**.

## Después de cada actualización de código
```

Reemplazar por:

```markdown
- **No le des clic a "Run NPM Install"** — `node_modules` ya viene armado y
  compatible dentro de `deploy/`; reinstalar ahí lo pisa con paquetes que
  quizás no coincidan con el entorno de build de Docker.
- Guarda y **Restart**.

## 6. Cron Job de notificaciones por correo (una sola vez)

Las notificaciones in-app se escriben al instante desde la propia app, pero
el correo lo manda un cron aparte (`/api/cron/notificaciones`) — sin este
paso, las notificaciones se acumulan en la base pero el correo nunca sale.

En cPanel → **Cron Jobs**:

- **Common Settings**: cada 1-2 minutos (ej. `*/2 * * * *`).
- **Command**:
  ```bash
  curl -s -X POST -H "x-cron-secret: TU_CRON_SECRET" https://promerc.tu-dominio.com/api/cron/notificaciones
  ```
  con el mismo valor de `CRON_SECRET` que capturaste en "Setup Node.js App"
  → Environment Variables (ver `.env.production.example`).

Verificar que corre: revisa el log de cPanel de ese cron después de la
primera ejecución, o consulta directo en `psql` cuántas filas de
`NotificacionDestinatario` tienen `correoEnviadoEn` distinto de `NULL`.

## Después de cada actualización de código
```

- [ ] **Step 2: Commit**

```bash
git add DEPLOY.md
git commit -m "Documentar el Cron Job de notificaciones por correo en DEPLOY.md"
```

---

## Self-Review

**1. Spec coverage:**
- Modelo de datos (`Notificacion`, `NotificacionDestinatario`, `ReglaNotificacion`) → Task 1, confirmado.
- Resolución de destinatarios (combinar canales con OR por usuario) → Task 2 (`resolverDestinatarios`) + Task 3 (`crearNotificacion`), confirmado.
- 4 eventos, disparados solo al completar el ciclo, en los 4 puntos exactos del spec → Tasks 6, 7, 8, confirmado (incluye el caso de dos disparadores de `VENTA_CERRADA`: directo sin exceder tolerancia, y tras aprobar la excepción).
- Filtrado de precio por rol (`OPERADOR`) → Task 2 (`resumenParaRol`), consumido en Tasks 4 y 9, confirmado.
- Evidencia adjunta resuelta por tipo de entidad (incluyendo el caso de Compra heredando la del Pesaje) → Task 4 (`resolverEvidenciaAdjunta`), confirmado.
- Campanita con polling cada 45s, pausado fuera de foco, marcar leída/todas → Tasks 9 y 10, confirmado.
- Correo con plantilla HTML + adjunto + botón "Ver en PROMERC" → Task 4, confirmado.
- Cron de envío con reintentos limitados (5 intentos) → Task 5, confirmado.
- Pantalla de administración (`ADMIN` únicamente, con la validación de rol para `VENTA_REQUIERE_APROBACION`) → Task 11, confirmado.
- Variable de entorno `CRON_SECRET` documentada → Tasks 5 y 12, confirmado.
- "Nunca debe romper la operación principal" → Task 3 (`crearNotificacion` atrapa todo internamente), confirmado.

**2. Placeholder scan:** sin "TBD"/"TODO"/frases vagas — cada step tiene código completo, o el bloque exacto de "antes"/"después" para los archivos que se modifican, o comandos exactos con el resultado esperado.

**3. Type consistency:** `crearNotificacion(data: { tipo, entidad, entidadId, ubicacionId, resumen })` (Task 3) se llama igual en las Tasks 6, 7, 8. Los tipos `ResumenPesajeCompletado`/`ResumenCompraRegistrada`/`ResumenVentaCerrada`/`ResumenVentaRequiereAprobacion` (Task 2) se usan con los mismos nombres de campo en las Tasks 6-8 y se leen con los mismos nombres en `notificaciones-email.ts` (Task 4) y `notification-bell.tsx`/`route.ts` (Tasks 9-10) vía el objeto `resumen` genérico (`Record<string, unknown>`, sin tipar el lado de lectura — coherente, ya que cruza el límite de un endpoint HTTP). `TIPO_NOTIFICACION_LABELS` (Task 2) se importa igual en Tasks 4, 10 y 11. `resumenParaRol(resumen, tipo, role)` mantiene la misma firma en Tasks 2, 4 y 9.

---

## Ejecución

Plan completo y guardado en `docs/superpowers/plans/2026-08-13-notificaciones.md`. Dos opciones de ejecución:

**1. Subagent-Driven (recomendado)** — un subagente nuevo por tarea, revisión entre tareas, iteración rápida.

**2. Ejecución en línea** — ejecutar las tareas en esta misma sesión con checkpoints de revisión por lote.

¿Cuál prefieres?
