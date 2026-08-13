# Visor de auditoría — diseño

## Contexto

`AuditLog` (`prisma/schema.prisma:376`) ya existe y se llena en cada acción
sensible del sistema: corregir/eliminar/anular Compra, Venta o Pesaje,
corregir folio de Lote, aprobar excepción de tolerancia, y enviar
Compra/Venta a NetSuite — 11 combinaciones de `entidad`/`accion` en total,
todas escritas desde acciones ya restringidas a `ADMIN` o `ADMIN`+`SUPERVISOR`
(ver `registrarAuditLog()` en `src/lib/audit.ts`). El dato se guarda pero
no hay ninguna pantalla que lo muestre — este visor cierra ese hueco.

## Alcance

- Página nueva de solo lectura en `/auditoria`, con filtros y paginación.
- Export a Excel con los mismos filtros, siguiendo el patrón de
  `/api/exports/*` ya existente.
- **Fuera de alcance** (posible extensión futura, no se construye ahora):
  una sección "Historial" embebida en el detalle de cada Venta/Compra/etc.,
  filtrando `AuditLog` por `entidad`+`entidadId` de ese registro específico.

## Acceso

`ADMIN` y `SUPERVISOR`, sin distinción — mismo criterio que Catálogos.
`AuditLog` no tiene `ubicacionId` propio (las acciones que audita ya
pertenecen a una ubicación indirectamente vía Lote/Venta/Compra/Pesaje,
pero no hay una columna directa para filtrar por ahí sin un join distinto
por cada tipo de entidad). Por eso **ambos roles ven el log completo de
todas las ubicaciones** — no se acota por ubicación en esta primera
versión.

Implementación: `src/app/(app)/auditoria/layout.tsx` con
`requireRole(["ADMIN", "SUPERVISOR"])`, mismo patrón que
`compras/layout.tsx`. Nuevo link "Auditoría" en el nav de
`src/app/(app)/layout.tsx`, condicionado igual que Compras/Ventas/Catálogos.

## Datos y filtros

Consulta directa con Prisma (sin el truco de ordenar/paginar en memoria que
usa `/lotes` — ahí es necesario porque compra/vendido son calculados; en
`AuditLog` todas las columnas relevantes son reales, así que `orderBy` y
`skip`/`take` van directo en la query):

```ts
prisma.auditLog.findMany({
  where: {
    createdAt: { gte: desde, lte: hasta },
    ...(entidad ? { entidad } : {}),
    ...(accion ? { accion } : {}),
    ...(usuarioId ? { usuarioId: Number(usuarioId) } : {}),
  },
  include: { usuario: { select: { nombre: true } } },
  orderBy: { createdAt: "desc" },
  skip: (pagina - 1) * perPage,
  take: perPage,
})
```

Total para la paginación: `prisma.auditLog.count()` con el mismo `where`
(conteo real en base de datos, no en memoria).

Filtros del formulario (`method="get"`, mismo patrón que `/lotes`):

- **Desde/Hasta** — `resolverRangoFecha`, igual que el resto de la app.
- **Entidad** — select con las 4 que existen hoy: `Lote`, `Venta`, `Compra`,
  `Pesaje`.
- **Acción** — select con las 11 acciones ya en uso. Se centralizan como
  constante con label legible en `src/lib/audit.ts`:

  ```ts
  export const ACCIONES_AUDITORIA: Record<string, string> = {
    FOLIO_CORREGIDO: "Folio corregido",
    VENTA_CORREGIDA: "Venta corregida",
    VENTA_ELIMINADA: "Venta eliminada",
    TOLERANCIA_APROBADA: "Tolerancia aprobada",
    VENTA_ENVIADA_NETSUITE: "Venta enviada a NetSuite",
    COMPRA_CORREGIDA: "Compra corregida",
    COMPRA_ELIMINADA: "Compra eliminada",
    COMPRA_ANULADA: "Compra anulada",
    COMPRA_ENVIADA_NETSUITE: "Compra enviada a NetSuite",
    PESAJE_CORREGIDO: "Pesaje corregido",
    PESAJE_ELIMINADO: "Pesaje eliminado",
  };
  ```

  Si se agrega una acción nueva en el futuro y no está en este diccionario,
  el filtro/columna debe mostrar el valor crudo de `accion` como fallback
  (no ocultar la fila).
- **Usuario** — select poblado con `SELECT DISTINCT usuarioId` de
  `AuditLog` (join a `Usuario` para el nombre) — no la lista completa de
  usuarios del sistema, así el filtro solo muestra a quien realmente
  aparece en el log.

## Tabla

Columnas: **Fecha** (`createdAt`), **Usuario** (`usuario.nombre`),
**Entidad**, **Acción** (vía `ACCIONES_AUDITORIA`, con fallback al valor
crudo), **Motivo** (guion si `null`), y una columna de acciones con:

- **"Ver registro"** — link a `/lotes/{id}`, `/ventas/{id}`, `/compras/{id}`
  o `/pesajes/{id}` según `entidad` (mapeo fijo de 4 entradas). **No se
  muestra** cuando `accion` es `VENTA_ELIMINADA`, `COMPRA_ELIMINADA` o
  `PESAJE_ELIMINADO` — esas acciones hacen `delete()` real en la base
  (confirmado en `compras/[id]/actions.ts` y `ventas/[id]/actions.ts`), el
  `entidadId` ya no existe y el link sería un 404 seguro.
- **"Ver detalle"** — `<details>` plegable por fila con
  `detalleAnterior`/`detalleNuevo` en `<pre>`
  (`JSON.stringify(valor, null, 2)`), renderizado solo si al menos uno de
  los dos no es `null`.

Paginación: componente `ListPagination` ya existente (mismo usado en
`/lotes`).

## Exportación

`src/app/api/exports/auditoria/route.ts`, mismo patrón que los exports
existentes: `requireRole(["ADMIN", "SUPERVISOR"])`, mismos filtros por
query params que la página. Columnas del Excel: `Fecha, Usuario, Entidad,
Accion, Motivo, DetalleAnterior, DetalleNuevo` (los dos últimos como JSON
en texto plano vía `JSON.stringify`).

## Testing

Sin test dedicado: es una página de solo lectura (query + render) sin
lógica pura no trivial propia — el único cálculo es el mapeo estático
entidad→ruta y el diccionario de labels de acción, ambos de una línea por
entrada. Mismo criterio que `/lotes` o `/compras` (páginas de listado
existentes sin test propio); la lógica que sí lo amerita (tolerancia,
NetSuite) ya está cubierta aparte en sus propios archivos `.test.ts`.

## Manejo de errores

Ninguno especial: sin resultados, la tabla muestra "Sin registros con
estos filtros" (mismo mensaje que las demás listas); acceso no autorizado
lo maneja `requireRole` con su redirect estándar a `/`.

## Nota sobre `.gitignore`

`docs/` está ignorado por completo (contiene `llaves.txt` con
credenciales). Se agregó una excepción para versionar
`docs/superpowers/` — los specs de diseño no son secretos y sí deben
quedar en el historial del repo.
