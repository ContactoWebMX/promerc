# Notificaciones — diseño

## Contexto

Hoy no hay forma de enterarse de que algo pasó en la operación salvo entrar
a revisar manualmente cada sección. `AuditLog` (`src/lib/audit.ts`) ya deja
rastro de correcciones y aprobaciones, pero es un log pasivo — nadie recibe
aviso de que un pesaje se cerró, una compra se registró o una venta quedó
pendiente de aprobación. Este documento diseña un sistema de notificaciones
con dos canales (campanita in-app + correo) para cerrar ese hueco, sin
agregar infraestructura pesada (nada de colas ni WebSockets — el hosting es
cPanel compartido, sin proceso persistente propio).

Decisiones ya validadas con el usuario antes de este documento:

- Campanita con actualización por *polling* cada ~45s (no tiempo real).
- Un ADMIN configura centralizadamente quién recibe qué (no autogestión).
- Los casos de excepción de tolerancia en Venta generan una notificación
  aparte ("requiere tu aprobación"), distinta de "venta cerrada".
- La evidencia fotográfica va como adjunto real del correo (no incrustada,
  no solo un link).
- Ya existe (o existirá antes de implementar esto) un SMTP de producción.
- Las notificaciones respetan la restricción de precios que ya existe para
  el rol `OPERADOR` — nunca deben filtrar precio/importe por este canal si
  no se ven en la propia app.

## Alcance

Se construye ahora:

1. Tabla de notificaciones in-app con campanita, badge de no leídas, marcar
   leída/todas.
2. Envío de correo con evidencia adjunta para los mismos eventos.
3. Pantalla de administración (`ADMIN`) para definir quién recibe qué, por
   tipo de evento y ubicación.
4. Cuatro eventos: pesaje completado, compra registrada, venta cerrada,
   venta requiere aprobación.

Fuera de alcance (quedan como propuestas para después, ver última sección):
resumen digest diario/semanal, alerta de pesaje "atorado" sin cerrar,
notificaciones al rol `CLIENTE`, purga automática de notificaciones viejas.

## Modelo de datos (Prisma)

```prisma
enum TipoNotificacion {
  PESAJE_COMPLETADO
  COMPRA_REGISTRADA
  VENTA_CERRADA
  VENTA_REQUIERE_APROBACION
}

// Un registro por evento ocurrido (no por destinatario) — el resumen se
// guarda una sola vez y se filtra por rol al momento de mostrarlo/enviarlo
// (ver "Resumen por evento y filtrado por rol"), así no se duplica el dato
// específico por cada destinatario.
model Notificacion {
  id          Int               @id @default(autoincrement())
  tipo        TipoNotificacion
  entidad     String // "Pesaje" | "Compra" | "Venta" — mismos valores que AuditLog.entidad
  entidadId   Int
  ubicacionId Int
  ubicacion   Ubicacion         @relation(fields: [ubicacionId], references: [id])
  resumen     Json // payload de datos para renderizar sin re-consultar todo, ver detalle abajo
  createdAt   DateTime          @default(now())

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
// aplica a todas las ubicaciones. Un usuario puede tener varias reglas
// (ej. una específica de su sede y otra general) — al resolver destinatarios
// se agrupan por usuario y los canales se combinan con OR, así que tener más
// de una regla que aplique nunca "resta" un canal, solo lo suma.
model ReglaNotificacion {
  id           Int              @id @default(autoincrement())
  tipo         TipoNotificacion
  usuarioId    Int
  usuario      Usuario          @relation(fields: [usuarioId], references: [id])
  ubicacionId  Int?
  ubicacion    Ubicacion?       @relation(fields: [ubicacionId], references: [id])
  canalInApp   Boolean          @default(true)
  canalCorreo  Boolean          @default(false)
  activo       Boolean          @default(true)
  createdAt    DateTime         @default(now())

  @@index([tipo, activo])
}
```

Agregar las relaciones inversas en `Usuario` (`notificaciones
NotificacionDestinatario[]`, `reglasNotificacion ReglaNotificacion[]`) y en
`Ubicacion` (`notificaciones Notificacion[]`, `reglasNotificacion
ReglaNotificacion[]`).

**Nota sobre duplicados en `ReglaNotificacion`:** no hay `@@unique` — Postgres
permite múltiples filas con `ubicacionId = NULL` para el mismo
`tipo`+`usuarioId`, así que técnicamente alguien podría crear dos reglas
idénticas por error. No es un bug: al resolver destinatarios simplemente se
combinan con OR, así que una regla duplicada es redundante pero inofensiva.
No se agrega una validación especial para esto — no vale la pena la
complejidad para un caso que en el peor caso no rompe nada.

## Resolución de destinatarios

Dado un evento con `tipo` y `ubicacionId`:

```ts
const reglas = await prisma.reglaNotificacion.findMany({
  where: {
    tipo,
    activo: true,
    OR: [{ ubicacionId: null }, { ubicacionId }],
  },
});

// Agrupar por usuarioId, combinando canales con OR
const porUsuario = new Map<number, { inApp: boolean; correo: boolean }>();
for (const r of reglas) {
  const actual = porUsuario.get(r.usuarioId) ?? { inApp: false, correo: false };
  porUsuario.set(r.usuarioId, {
    inApp: actual.inApp || r.canalInApp,
    correo: actual.correo || r.canalCorreo,
  });
}
```

Cada entrada resultante con `inApp || correo` en `true` genera una fila
`NotificacionDestinatario` (con `requiereCorreo` = el valor `correo`
resuelto). Si nadie tiene reglas activas para ese tipo+ubicación, no se crea
ninguna fila de destinatario — pero **la fila `Notificacion` sí se crea
siempre** (queda como historial aunque nadie estuviera suscrito en ese
momento; si luego se agrega una regla, no aparecen notificaciones
retroactivas — solo aplica hacia adelante).

## Catálogo de eventos y puntos de disparo

Se dispara **solo al completarse el ciclo**, nunca en pasos intermedios.
Todas las llamadas van después de que la operación principal ya tuvo éxito
(commit de Prisma confirmado), nunca antes — si notificar falla, no debe
revertir ni bloquear la operación real (ver "Manejo de errores").

| Tipo | Dónde se dispara | Condición |
|---|---|---|
| `PESAJE_COMPLETADO` | `src/app/(app)/pesajes/[id]/actions.ts`, función `cerrarPesaje`, después del `prisma.$transaction([...])` exitoso (antes del `redirect`) | Pesaje pasa a estado `COMPLETO` |
| `COMPRA_REGISTRADA` | `src/app/(app)/compras/nuevo/[pesajeId]/actions.ts`, función `crearCompra`, después de `actualizarEstadoLote(pesaje.loteId)` (antes del `redirect`) | Se crea la `Compra` |
| `VENTA_CERRADA` | `src/app/(app)/ventas/[id]/actions.ts`, función `reportarPesoVenta`, después del `prisma.$transaction(operaciones)` exitoso — **solo si `excede` es `false`** | Venta pasa directo a `CERRADA` sin exceder tolerancia |
| `VENTA_REQUIERE_APROBACION` | mismo lugar que arriba (`reportarPesoVenta`) — **solo si `excede` es `true`** | Venta cae en `PENDIENTE_APROBACION` |
| `VENTA_CERRADA` (segundo disparador) | `src/app/(app)/ventas/[id]/actions.ts`, función `aprobarExcepcionTolerancia`, después de `prisma.venta.update({ estado: "CERRADA" })` | Venta pendiente se aprueba y cierra |

Anulaciones y eliminaciones (`anularPesaje`, `eliminarPesaje`, `anularCompra`,
`eliminarCompra`, `eliminarVenta`) **no generan notificación** — ya quedan
en `AuditLog` y son eventos de corrección, no de operación normal.

## Resumen por evento y filtrado por rol

`Notificacion.resumen` guarda **todo el dato relevante sin filtrar** (incluye
precio/importe donde aplique) — el filtrado por rol ocurre al leer, nunca al
guardar, así una sola fila sirve para cualquier destinatario:

- `PESAJE_COMPLETADO`: `{ folioTicket, ubicacionNombre, proveedorNombre, articuloNombre, netoKg }` — sin precio, no aplica.
- `COMPRA_REGISTRADA`: `{ folioTicket, proveedorNombre, netoKg, precioUnitarioKg, importeTotal }`.
- `VENTA_CERRADA`: `{ clienteNombre, pesoReportadoClienteKg, precioUnitarioKg, importeTotal, diferenciaKg }`.
- `VENTA_REQUIERE_APROBACION`: `{ clienteNombre, pesoVendidoKg, pesoReportadoClienteKg, diferenciaKg, umbralPct }` — sin precio: quien aprueba (`ADMIN`/`SUPERVISOR`) sí puede verlo, pero el dato que importa para decidir es la diferencia, no el importe.

Función compartida `resumenParaRol(resumen, tipo, role)` en
`src/lib/notificaciones.ts` que, si `role === "OPERADOR"`, elimina
`precioUnitarioKg`/`importeTotal` del objeto antes de pasarlo al renderer
(dropdown in-app y plantilla de correo). Un `OPERADOR` normalmente no tiene
reglas de `COMPRA_REGISTRADA`/`VENTA_CERRADA` configuradas, pero esta función
es el cinturón de seguridad si un `ADMIN` sí lo agrega ahí — mismo criterio
de "nunca confiar en que nadie configuró algo mal" que ya se usó en las
validaciones de servidor de esta sesión.

## Evidencia adjunta en el correo

Se resuelve al momento de enviar, no se guarda ruta de archivo en
`Notificacion` (evita acoplar el modelo a rutas de disco):

- `PESAJE_COMPLETADO`: `Evidencia` donde `pesajeId = entidadId`, tipo
  `TICKET_BASCULA` (la del cierre, no la de tara).
- `COMPRA_REGISTRADA`: la `Compra` no tiene evidencia propia — se resuelve
  `Compra.pesajeId` → misma `Evidencia` que arriba.
- `VENTA_CERRADA`: `Evidencia` donde `ventaId = entidadId`, tipo
  `COMPROBANTE_CLIENTE`, si existe (solo se sube cuando hubo diferencia
  reportada — si no hay, el correo se manda sin adjunto, no es un error).
- `VENTA_REQUIERE_APROBACION`: mismo criterio que `VENTA_CERRADA` — aquí
  casi siempre existe, porque una diferencia que excede tolerancia implica
  que se reportó diferencia.

Los archivos ya llegan comprimidos a WebP (~200-500KB) desde el trabajo de
compresión de esta misma sesión, así que no hace falta ningún límite de
tamaño adicional para el adjunto.

## In-app: campanita

**Endpoint** `GET /api/notificaciones` (autenticado vía `getCurrentUser`):
regresa `{ noLeidas: number, items: NotificacionItem[] }` con las últimas 30
(leídas + no leídas) de `NotificacionDestinatario` del usuario actual,
ordenadas `createdAt desc`, con el `resumen` ya filtrado por rol
(`resumenParaRol`). El link de cada item se arma reutilizando
`rutaRegistro(entidad, entidadId)`, ya existente en `src/lib/audit.ts` —
mismo mapeo entidad→ruta que usa el visor de auditoría, sin duplicarlo.

**Marcar leída**: `POST /api/notificaciones/[id]/leer` — valida que el
`NotificacionDestinatario.id` pertenezca al usuario actual antes de
actualizar `leidoEn`. **Marcar todas**: `POST
/api/notificaciones/leer-todas` — `updateMany` con `usuarioId` +
`leidoEn: null`.

**Componente** `src/components/notification-bell.tsx` (`"use client"`):
ícono de campana con badge de conteo en `AppNav` (junto a `UbicacionChip`,
antes del botón "Salir" — en el bloque desktop y en el menú móvil, igual que
el resto de los elementos de esa barra). *Polling* cada 45s con
`setInterval`, pausado con
[`document.visibilityState`](https://developer.mozilla.org/docs/Web/API/Document/visibilityState)
cuando la pestaña no está en foco (retoma inmediatamente al volver a
enfocar). Dropdown con las notificaciones agrupadas por fecha, click navega
y marca leída (`router.push` + llamada a marcar leída en paralelo, sin
esperar la respuesta para no sentirse lento), botón "Marcar todas como
leídas" arriba del dropdown.

No se muestra a `role === "CLIENTE"` — mismo criterio que `BuscarForm` en
`AppNav` (ese rol tiene su propio nav reducido).

## Correo

**Plantilla** `src/lib/notificaciones-email.ts`, HTML simple (tabla de
datos + header con el nombre del sistema, mismo criterio visual que ya
existe en el resto de la app — sin librería de templates nueva, un template
string es suficiente para este volumen). Asunto:
`"<Título del evento> — <folio o referencia principal>"` (ej. `"Pesaje
completado — Ticket 4021"`). Cuerpo: tabla con el resumen ya filtrado por
rol del destinatario, botón/link `"Ver en PROMERC"` a la ruta de la
entidad, evidencia como adjunto (`attachments` de Nodemailer, leída con
`readStoredFile` de `src/lib/storage.ts`).

**Envío**: `sendMail` se agrega a `src/lib/email.ts`, reutilizando el mismo
`transporter` que ya existe ahí (nada de credenciales o proveedor nuevo).

**Cron** `src/app/api/cron/notificaciones/route.ts` — `POST` protegido
comparando un header `x-cron-secret` contra `process.env.CRON_SECRET` (nueva
variable de entorno, ver `DEPLOY.md`). Cada corrida:

```ts
const pendientes = await prisma.notificacionDestinatario.findMany({
  where: { requiereCorreo: true, correoEnviadoEn: null, correoIntentos: { lt: 5 } },
  include: { notificacion: true, usuario: true },
  orderBy: { createdAt: "asc" },
  take: 50,
});

for (const item of pendientes) {
  try {
    await enviarCorreoNotificacion(item);
    await prisma.notificacionDestinatario.update({
      where: { id: item.id },
      data: { correoEnviadoEn: new Date() },
    });
  } catch (error) {
    await prisma.notificacionDestinatario.update({
      where: { id: item.id },
      data: {
        correoIntentos: { increment: 1 },
        correoError: error instanceof Error ? error.message : String(error),
      },
    });
  }
}
```

Se configura como **Cron Job de cPanel** (disponible en hosting compartido,
sin necesitar acceso root) que hace un `curl` a este endpoint cada 1-2
minutos — el paso exacto de configuración se agrega a `DEPLOY.md` al
implementar, no es parte de este documento de diseño.

**Límite de 5 intentos**: pasado ese número, la fila queda con
`correoError` pero deja de reintentarse — evita spamear un SMTP caído
indefinidamente. No hay alerta de "correo definitivamente no enviado" en
esta primera versión (queda visible solo si alguien consulta la tabla
directamente) — se anota como posible mejora futura si en la práctica
llega a pasar seguido.

## Pantalla de administración de reglas

Nueva sección `/catalogos/notificaciones`, mismo patrón que el resto de
catálogos (`CatalogForm` + `CatalogTable`, `page.tsx` + `[id]/page.tsx` +
`actions.ts`, esquema en `src/lib/validations/catalogos.ts`). Acceso: solo
`ADMIN` (más restrictivo que el resto de catálogos, mismo criterio ya usado
en `catalogos/usuarios` — aquí se decide quién ve qué de la operación
completa, no es un catálogo operativo cualquiera).

Campos del formulario: `tipo` (select con las 4 opciones, labels legibles
tipo `"Pesaje completado"`), `usuarioId` (select de usuarios activos,
excluyendo `CLIENTE`), `ubicacionId` (select de ubicaciones + opción
`"Todas"` = `null`), `canalInApp` y `canalCorreo` (checkboxes), `activo`
(el toggle estándar de `CatalogTable`).

**Validación server-side**: si `tipo === "VENTA_REQUIERE_APROBACION"`, el
usuario seleccionado debe tener `role` `ADMIN` o `SUPERVISOR` (son los
únicos que pueden aprobar una excepción de tolerancia,
`aprobarExcepcionTolerancia` ya exige ese rol) — si no, error de validación
explicando por qué. El listado (`CatalogTable`) muestra `Tipo`, `Usuario`,
`Ubicación` (o "Todas"), `In-app`/`Correo` (badges), `Activo`.

## Acceso y permisos

- Recibir notificaciones (in-app/correo): cualquier usuario no-`CLIENTE`
  que un `ADMIN` haya configurado — sin distinción de rol propia más allá
  de la restricción de precio ya cubierta.
- Configurar reglas (`/catalogos/notificaciones`): solo `ADMIN`.
- Endpoints `/api/notificaciones*`: cualquier usuario autenticado, siempre
  acotado a sus propias filas (`usuarioId` del `getCurrentUser()` actual,
  nunca un id de la URL/body).
- `/api/cron/notificaciones`: sin sesión de usuario — protegido por el
  secreto compartido `CRON_SECRET`, igual de sensible que cualquier otra
  credencial del `.env` (no se loguea, no se expone en el cliente).

## Manejo de errores

Disparar una notificación **nunca debe romper la operación principal**. En
cada uno de los 4 puntos de disparo, la llamada a crear
`Notificacion`+`NotificacionDestinatario` va envuelta en un `try/catch` que
solo hace `console.error` si falla — el `redirect()` de la Server Action
sigue igual. Mismo criterio que ya se usa en `postRecord` de
`src/lib/netsuite.ts` para la confirmación de orden: la parte crítica
(guardar el pesaje/compra/venta) ya tuvo éxito antes de llegar aquí, y una
notificación perdida es recuperable (se puede reconstruir manualmente si
hace falta) mientras que revertir una operación exitosa por un fallo de
notificación sí sería un problema real.

El envío de correo dentro del cron ya tiene su propio manejo (reintentos,
ver arriba) — un fallo de un destinatario no debe detener el procesamiento
de los demás en la misma corrida (cada `try/catch` es por item, dentro del
`for`, no alrededor de todo el batch).

## Testing

- `src/lib/notificaciones.test.ts`: `resumenParaRol` (oculta precio/importe
  para `OPERADOR`, los conserva para los demás roles) y la función de
  resolución de destinatarios (agrupa por usuario, combina canales con OR,
  respeta `ubicacionId` null vs. específico) — es la lógica pura no trivial
  de este diseño, mismo criterio que `tolerancia.test.ts`.
- Sin test de integración de correo real (igual que
  `sendPasswordResetEmail` hoy, que tampoco lo tiene) — se prueba manual en
  dev con el `console.log` de respaldo cuando no hay `SMTP_HOST`.

## Variables de entorno nuevas

- `CRON_SECRET` — string aleatorio (`openssl rand -base64 32`, igual que
  `SESSION_SECRET`) para proteger `/api/cron/notificaciones`.

Se documentan en `.env.production.example` y en la sección de "Setup Node.js
App" de `DEPLOY.md` al implementar.

## Fuera de alcance (propuestas para después)

1. **Resumen diario/semanal por correo** — para quien prefiera no recibir
   correo por cada operación individual. Requeriría su propio cron y una
   plantilla distinta; no se construye ahora para no inflar el alcance de
   esta primera versión.
2. **Alerta de pesaje "atorado"** (tara capturada hace más de X horas sin
   cerrar) — es un tipo de evento distinto (por tiempo transcurrido, no por
   una transición de estado), amerita su propio diseño de cron/consulta.
3. **Notificar al rol `CLIENTE`** — el modelo de `ReglaNotificacion` ya lo
   soportaría sin cambios de esquema, pero decidir qué debe ver un cliente
   de portal (¿su propia venta nada más?) es una decisión de producto
   aparte.
4. **Columna "pendiente de cierre hace X" en el listado de Pesajes** — es
   una mejora de visibilidad distinta a una notificación, se resolvería con
   una query normal en `pesajes/page.tsx`, no con este sistema.
