# Integración PROMERC → NetSuite (Órdenes de Compra y Venta)

Fecha: 2026-07-29

## Propósito

Permitir que, desde la propia app PROMERC, un ADMIN o SUPERVISOR pueda crear en
NetSuite la Orden de Compra correspondiente a una Compra y la Orden de Venta
correspondiente a una Venta, sin captura manual duplicada en NetSuite.

## Alcance v1

- Compras (Purchase Order) y Ventas (Sales Order), ambas desde el inicio.
- Envío manual vía botón en el detalle de cada Compra/Venta — sin disparo
  automático al cerrar, sin envío por lote desde las listas.
- Una sola subsidiaria de NetSuite fija para todas las Ubicaciones de PROMERC.
- Artículos en NetSuite son inventariables simples, **no lotificados** — las
  líneas de la orden no llevan número de lote ni referencia al `Lote` de
  PROMERC, solo cantidad y tarifa por artículo.

### Fuera de alcance (v1)

- Sincronización automática al cerrar una Compra/Venta.
- Creación automática de Vendor/Customer/Item en NetSuite si no existen.
- Reenvío o actualización de la orden en NetSuite tras una corrección
  posterior en PROMERC (`corregirCompra`/`corregirVenta`).
- Múltiples subsidiarias (una por Ubicación).
- Envío en lote (bulk) desde `/compras` o `/ventas`.

## Autenticación con NetSuite

OAuth2 client-credentials (machine-to-machine, sin token de usuario), contra
el REST Record API de NetSuite. Se descarta SuiteScript/RESTlet (obliga a
mantener código también dentro de NetSuite) y SOAP/SuiteTalk clásico (legado,
más pesado) — el REST Record API cubre la creación de `purchaseorder` y
`salesorder` con llamadas HTTP simples.

Variables de entorno nuevas (mismo patrón que `ANTHROPIC_API_KEY` y las
`SMTP_*` en `src/lib/email.ts` — secretos de terceros solo en `.env` del
servidor, nunca en base de datos ni en una pantalla editable):

```
NETSUITE_ACCOUNT_ID=
NETSUITE_CLIENT_ID=
NETSUITE_CLIENT_SECRET=
NETSUITE_SUBSIDIARY_ID=14   # PRO MERC PUEBLA
```

Si falta alguna, el botón de envío se deshabilita con un mensaje explicando
qué falta configurar — mismo criterio que `ocr.ts` cuando falta
`ANTHROPIC_API_KEY`.

## Capa de API — `src/lib/netsuite.ts`

- `obtenerAccessToken()`: `POST` a
  `https://{account}.suitetalk.api.netsuite.com/services/rest/auth/oauth2/v1/token`
  con client-credentials. Se pide un token nuevo en cada llamada — no se
  cachea; el volumen (clicks manuales, no automatizados) no justifica la
  complejidad de un cache con expiración.
- `crearOrdenCompra(compra)`: arma el JSON de `purchaseorder` y hace `POST` a
  `/services/rest/record/v1/purchaseorder` con `fetch` nativo (Node 22, sin
  dependencia nueva).
- `crearOrdenVenta(venta)`: igual para `/services/rest/record/v1/salesorder`.

Ambas funciones devuelven `{ id, tranId }` en éxito o lanzan un error con el
mensaje de NetSuite en falla.

## Modelo de datos (Prisma)

Campos nuevos, todos opcionales (`.nullish()` en las validaciones Zod que los
toquen, por el patrón ya establecido en este repo):

- `Proveedor.netsuiteVendorId String?`
- `Cliente.netsuiteCustomerId String?`
- `Articulo.netsuiteItemId String?`
- `Compra.netsuiteOrderId String?`, `Compra.netsuiteOrderNumber String?`,
  `Compra.netsuiteSyncedAt DateTime?`
- `Venta.netsuiteOrderId String?`, `Venta.netsuiteOrderNumber String?`,
  `Venta.netsuiteSyncedAt DateTime?`

Los tres primeros se capturan una sola vez por un ADMIN a través del
`CatalogForm` genérico que ya usan `proveedores`, `clientes` y `articulos`
(campo de texto adicional en cada config).

## Mapeo de campos por orden

**Compra → purchaseorder**
- `entity` = `proveedor.netsuiteVendorId`
- `subsidiary` = `NETSUITE_SUBSIDIARY_ID`
- `tranDate` = `compra.createdAt`
- una línea: `item` = `articulo.netsuiteItemId`, `quantity` = neto en kg del
  pesaje, `rate` = `compra.precioUnitarioKg`

**Venta → salesorder**
- `entity` = `cliente.netsuiteCustomerId`
- `subsidiary` = `NETSUITE_SUBSIDIARY_ID`
- `tranDate` = `venta.createdAt`
- una línea: `item` = `articulo.netsuiteItemId`, `quantity` =
  `venta.pesoReportadoClienteKg`, `rate` = `venta.precioUnitarioKg`

Sin número de lote ni referencia a `Lote`/`LoteMovimiento` en ninguna de las
dos — NetSuite no lotifica estos artículos.

## Condición para mostrar el botón "Enviar a NetSuite"

- Compra: `estado !== "CANCELADA"` y `netsuiteOrderId === null`. **No** se usa
  `estado === "CERRADA"` — ese estado en `Compra` significa que el `Lote` ya
  se vendió por completo (`actualizarEstadoLote` en `src/lib/lote.ts`), no que
  la compra esté lista para facturar. Una Compra queda completa (precio, peso,
  importe) desde el momento en que se crea.
- Venta: `estado === "CERRADA"` y `netsuiteOrderId === null` — aquí sí
  corresponde, significa peso confirmado por el cliente y dentro de
  tolerancia (o excepción aprobada).
- Visible solo para roles `ADMIN` y `SUPERVISOR` (`requireRole`).
- Si al Proveedor/Cliente/Artículo relacionado le falta su ID de NetSuite, el
  botón se deshabilita con el mensaje "Falta configurar el ID de NetSuite en
  [Proveedor/Cliente/Artículo] «X»" en vez de fallar genérico contra la API.

## Flujo de envío

Mismo patrón que `corregirCompra`/`anularCompra`: `ActionDialog` +
`CatalogForm` con una Server Action.

1. Usuario hace click en "Enviar a NetSuite" → confirma en el diálogo.
2. La Server Action llama a `requireRole(["ADMIN", "SUPERVISOR"])`, valida
   estado y mapeo de IDs, y llama a `crearOrdenCompra`/`crearOrdenVenta`.
3. Éxito: guarda `netsuiteOrderId`, `netsuiteOrderNumber`, `netsuiteSyncedAt`
   en la Compra/Venta; registra `AuditLog`
   (`COMPRA_ENVIADA_NETSUITE`/`VENTA_ENVIADA_NETSUITE`) con el número de
   orden; `revalidatePath`.
4. Falla (red, credenciales, orden rechazada por NetSuite): mensaje de error
   inline vía el mismo `{ message }` de `CatalogFormState`, nada se guarda, el
   botón sigue disponible para reintentar. Sin cola ni reintentos automáticos
   — no hay infraestructura de jobs en este proyecto y el volumen (clicks
   manuales, unas pocas órdenes al día) no lo justifica.

## Indicador

Una vez `netsuiteOrderId` está presente, el botón se reemplaza por un
`EstadoBadge` de tono positivo mostrando el número de orden de NetSuite
(`netsuiteOrderNumber`). Esto evita reenvíos duplicados — no hay botón de
"reenviar" en v1, ni siquiera tras una corrección posterior en PROMERC.

## Testing

- Self-check tipo `node:test` (mismo patrón que `tolerancia.test.ts`) para el
  armado del JSON de `purchaseorder`/`salesorder` en `src/lib/netsuite.ts`:
  dado un objeto Compra/Venta con sus relaciones, el payload construido tiene
  `entity`, `subsidiary` e `item` correctos y no incluye ningún campo de lote.
- La llamada HTTP real a NetSuite no se prueba en automático (requiere
  credenciales reales) — se verifica manualmente contra el sandbox de
  NetSuite antes de dar por cerrada la implementación.
