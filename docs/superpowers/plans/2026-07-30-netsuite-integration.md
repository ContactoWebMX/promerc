# Integración NetSuite (Órdenes de Compra/Venta) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir que un ADMIN o SUPERVISOR cree, desde el detalle de una Compra o Venta en PROMERC, la Orden de Compra / Orden de Venta correspondiente en NetSuite, con un botón manual y un indicador del resultado.

**Architecture:** Nuevo módulo `src/lib/netsuite.ts` (sin dependencias de Prisma) que firma requests con Token-Based Authentication (OAuth 1.0a / HMAC-SHA256, vía `node:crypto`) y llama al REST Record API de NetSuite con `fetch` nativo. Server Actions nuevas en `compras/[id]/actions.ts` y `ventas/[id]/actions.ts` orquestan: cargar la Compra/Venta con sus relaciones, validar precondiciones, llamar a `netsuite.ts`, persistir el resultado y auditar. Tres catálogos (Proveedor, Cliente, Articulo) ganan un campo de ID externo capturado a mano por un ADMIN.

**Tech Stack:** Next.js 16 App Router / Server Actions, Prisma 7, Zod 4, `node:crypto`, `fetch` nativo — sin dependencias nuevas.

**Spec:** `docs/superpowers/specs/2026-07-29-netsuite-integration-design.md`

## Global Constraints

- Node.js `>=20.9.0` ya declarado en `package.json` `engines`.
- Campos opcionales de formulario/Zod: usar `.nullish()`, nunca `.optional()` (`formData.get()` devuelve `null`, no `undefined`).
- Nunca usar `.bind()` en una Server Action pasada a `useActionState` (loop infinito conocido en esta versión de Next) — pasar el id como campo oculto (`hiddenId`/`hidden` input), como ya hace el resto del código.
- Prisma: importar tipos desde `@/generated/prisma`, nunca de `@prisma/client`.
- Autenticación con NetSuite: **Token-Based Authentication (TBA)**, no OAuth2 client-credentials — ver spec para el porqué.
- Sin número de lote ni referencia a `Lote`/`LoteMovimiento` en ningún payload hacia NetSuite — los artículos en NetSuite no son lotificados.
- Una sola subsidiaria de NetSuite fija (`NETSUITE_SUBSIDIARY_ID` en `.env`), no una por Ubicación.
- Botón "Enviar a NetSuite" visible solo para roles `ADMIN` y `SUPERVISOR`.
- Disparo manual únicamente (botón en el detalle) — nada automático al cerrar, nada en lote desde las listas.
- Secretos de NetSuite solo en variables de entorno del servidor — nunca en base de datos ni en una pantalla editable.
- Una vez `netsuiteOrderId` está seteado, no se reenvía (evita duplicados en NetSuite) — no hay botón de reenvío en v1.

---

## Task 1: Migración Prisma — campos de NetSuite en catálogos y transacciones

**Files:**
- Modify: `prisma/schema.prisma:101-135` (modelos `Proveedor`, `Cliente`, `Articulo`)
- Modify: `prisma/schema.prisma:238-293` (modelos `Compra`, `Venta`)

**Interfaces:**
- Produces: `Proveedor.netsuiteVendorId: string | null`, `Cliente.netsuiteCustomerId: string | null`, `Articulo.netsuiteItemId: string | null`, `Compra.netsuiteOrderId/netsuiteOrderNumber: string | null`, `Compra.netsuiteSyncedAt: Date | null`, mismos tres últimos en `Venta`. Todas las tareas siguientes consumen estos campos vía el cliente Prisma regenerado (`@/generated/prisma`).

- [ ] **Step 1: Editar el modelo `Proveedor`**

En `prisma/schema.prisma`, reemplazar:

```prisma
model Proveedor {
  id        Int      @id @default(autoincrement())
  nombre    String
  rfc       String?
  telefono  String?
  activo    Boolean  @default(true)
  createdAt DateTime @default(now())

  pesajes Pesaje[]
  compras Compra[]
}
```

por:

```prisma
model Proveedor {
  id               Int      @id @default(autoincrement())
  nombre           String
  rfc              String?
  telefono         String?
  netsuiteVendorId String? // ID interno del Vendor en NetSuite, para la Orden de Compra
  activo           Boolean  @default(true)
  createdAt        DateTime @default(now())

  pesajes Pesaje[]
  compras Compra[]
}
```

- [ ] **Step 2: Editar el modelo `Cliente`**

Reemplazar:

```prisma
model Cliente {
  id        Int      @id @default(autoincrement())
  nombre    String
  rfc       String?
  telefono  String?
  activo    Boolean  @default(true)
  createdAt DateTime @default(now())

  usuarios Usuario[]
  ventas   Venta[]
}
```

por:

```prisma
model Cliente {
  id                 Int      @id @default(autoincrement())
  nombre             String
  rfc                String?
  telefono           String?
  netsuiteCustomerId String? // ID interno del Customer en NetSuite, para la Orden de Venta
  activo             Boolean  @default(true)
  createdAt          DateTime @default(now())

  usuarios Usuario[]
  ventas   Venta[]
}
```

- [ ] **Step 3: Editar el modelo `Articulo`**

Reemplazar:

```prisma
model Articulo {
  id        Int      @id @default(autoincrement())
  nombre    String   @unique // ej. "Cartón"
  activo    Boolean  @default(true)
  createdAt DateTime @default(now())

  pesajes     Pesaje[]
  lotes       Lote[]
  ventas      Venta[]
  tolerancias ToleranciaConfig[]
}
```

por:

```prisma
model Articulo {
  id             Int      @id @default(autoincrement())
  nombre         String   @unique // ej. "Cartón"
  netsuiteItemId String? // ID interno del Item en NetSuite (inventariable, no lotificado)
  activo         Boolean  @default(true)
  createdAt      DateTime @default(now())

  pesajes     Pesaje[]
  lotes       Lote[]
  ventas      Venta[]
  tolerancias ToleranciaConfig[]
}
```

- [ ] **Step 4: Editar el modelo `Compra`**

Reemplazar:

```prisma
model Compra {
  id               Int          @id @default(autoincrement())
  pesajeId         Int          @unique
  pesaje           Pesaje       @relation(fields: [pesajeId], references: [id])
  ubicacionId      Int
  ubicacion        Ubicacion    @relation(fields: [ubicacionId], references: [id])
  proveedorId      Int
  proveedor        Proveedor    @relation(fields: [proveedorId], references: [id])
  loteId           Int?
  lote             Lote?        @relation(fields: [loteId], references: [id])
  precioUnitarioKg Decimal      @db.Decimal(10, 2)
  importeTotal     Decimal      @db.Decimal(12, 2)
  estado           EstadoCompra @default(ABIERTA)
  createdAt        DateTime     @default(now())
  updatedAt        DateTime     @updatedAt
}
```

por:

```prisma
model Compra {
  id               Int          @id @default(autoincrement())
  pesajeId         Int          @unique
  pesaje           Pesaje       @relation(fields: [pesajeId], references: [id])
  ubicacionId      Int
  ubicacion        Ubicacion    @relation(fields: [ubicacionId], references: [id])
  proveedorId      Int
  proveedor        Proveedor    @relation(fields: [proveedorId], references: [id])
  loteId           Int?
  lote             Lote?        @relation(fields: [loteId], references: [id])
  precioUnitarioKg Decimal      @db.Decimal(10, 2)
  importeTotal     Decimal      @db.Decimal(12, 2)
  estado           EstadoCompra @default(ABIERTA)
  createdAt        DateTime     @default(now())
  updatedAt        DateTime     @updatedAt

  netsuiteOrderId     String? // ID interno de la Purchase Order en NetSuite
  netsuiteOrderNumber String? // tranId (folio legible), ej. "PO123"
  netsuiteSyncedAt    DateTime?
}
```

- [ ] **Step 5: Editar el modelo `Venta`**

Reemplazar:

```prisma
  precioUnitarioKg   Decimal     @db.Decimal(10, 2)
  importeTotal       Decimal     @db.Decimal(12, 2)
  estado             EstadoVenta @default(BORRADOR)
  toleranciaExcedida Boolean     @default(false)

  createdByUsuarioId           Int
```

por:

```prisma
  precioUnitarioKg   Decimal     @db.Decimal(10, 2)
  importeTotal       Decimal     @db.Decimal(12, 2)
  estado             EstadoVenta @default(BORRADOR)
  toleranciaExcedida Boolean     @default(false)

  netsuiteOrderId     String? // ID interno de la Sales Order en NetSuite
  netsuiteOrderNumber String? // tranId (folio legible), ej. "SO456"
  netsuiteSyncedAt    DateTime?

  createdByUsuarioId           Int
```

- [ ] **Step 6: Crear y aplicar la migración**

Run: `npx prisma migrate dev --name netsuite_integracion`
Expected: crea `prisma/migrations/<timestamp>_netsuite_integracion/migration.sql` y termina con `Your database is now in sync with your schema.` (requiere Postgres local corriendo, `DATABASE_URL` ya está en `.env`).

- [ ] **Step 7: Regenerar el cliente Prisma**

Run: `npx prisma generate`
Expected: `Generated Prisma Client ... to ./src/generated/prisma` sin errores.

- [ ] **Step 8: Verificar que el proyecto sigue compilando**

Run: `npx tsc --noEmit`
Expected: sin errores (los campos nuevos son opcionales, no rompen código existente).

- [ ] **Step 9: Commit**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "Agregar campos de NetSuite a Proveedor, Cliente, Articulo, Compra y Venta"
```

---

## Task 2: Capa de API de NetSuite — `src/lib/netsuite.ts`

**Files:**
- Create: `src/lib/netsuite.ts`
- Test: `src/lib/netsuite.test.ts`
- Modify: `package.json:12` (script `test`)

**Interfaces:**
- Consumes: variables de entorno `NETSUITE_ACCOUNT_ID`, `NETSUITE_CONSUMER_KEY`, `NETSUITE_CONSUMER_SECRET`, `NETSUITE_TOKEN_ID`, `NETSUITE_TOKEN_SECRET`, `NETSUITE_SUBSIDIARY_ID`.
- Produces: `percentEncode(value: string): string`, `construirPayloadOrdenCompra(input): object`, `construirPayloadOrdenVenta(input): object`, `crearOrdenCompra(input): Promise<{ id: string; tranId: string }>`, `crearOrdenVenta(input): Promise<{ id: string; tranId: string }>` — usados por las Server Actions de las Tasks 4 y 5.

- [ ] **Step 1: Escribir el test que falla primero**

Create `src/lib/netsuite.test.ts`:

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  percentEncode,
  construirPayloadOrdenCompra,
  construirPayloadOrdenVenta,
} from "./netsuite";

test("percentEncode escapa los caracteres reservados de OAuth 1.0a que encodeURIComponent no toca", () => {
  assert.equal(percentEncode("a b!c*d'e(f)g"), "a%20b%21c%2Ad%27e%28f%29g");
});

test("construirPayloadOrdenCompra arma entity/subsidiary/item y no incluye lote", () => {
  const payload = construirPayloadOrdenCompra({
    netsuiteVendorId: "123",
    netsuiteItemId: "456",
    netoKg: 980.5,
    precioUnitarioKg: 3.5,
    subsidiaryId: "14",
  });

  assert.deepEqual(payload, {
    entity: { id: "123" },
    subsidiary: { id: "14" },
    item: {
      items: [{ item: { id: "456" }, quantity: 980.5, rate: 3.5 }],
    },
  });
  const json = JSON.stringify(payload).toLowerCase();
  assert.equal(json.includes("lote"), false);
  assert.equal(json.includes("lot"), false);
});

test("construirPayloadOrdenVenta arma entity/subsidiary/item y no incluye lote", () => {
  const payload = construirPayloadOrdenVenta({
    netsuiteCustomerId: "789",
    netsuiteItemId: "456",
    pesoKg: 500,
    precioUnitarioKg: 4.2,
    subsidiaryId: "14",
  });

  assert.deepEqual(payload, {
    entity: { id: "789" },
    subsidiary: { id: "14" },
    item: {
      items: [{ item: { id: "456" }, quantity: 500, rate: 4.2 }],
    },
  });
  const json = JSON.stringify(payload).toLowerCase();
  assert.equal(json.includes("lote"), false);
  assert.equal(json.includes("lot"), false);
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `npx tsx --test src/lib/netsuite.test.ts`
Expected: FAIL — `Cannot find module './netsuite'` (el archivo todavía no existe).

- [ ] **Step 3: Implementar `src/lib/netsuite.ts`**

Create `src/lib/netsuite.ts`:

```ts
import "server-only";
import crypto from "node:crypto";

function requerido(nombre: string): string {
  const valor = process.env[nombre];
  if (!valor) {
    throw new Error(`Falta configurar ${nombre} para la integración con NetSuite.`);
  }
  return valor;
}

// RFC 3986: encodeURIComponent no escapa !, *, ' ni (), pero OAuth 1.0a los
// requiere codificados — sin esto la firma HMAC no coincide con la que
// calcula NetSuite del lado del servidor.
export function percentEncode(value: string): string {
  return encodeURIComponent(value).replace(
    /[!*'()]/g,
    (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}

function firmarSolicitudTBA(method: string, url: string): string {
  const accountId = requerido("NETSUITE_ACCOUNT_ID");
  const consumerKey = requerido("NETSUITE_CONSUMER_KEY");
  const consumerSecret = requerido("NETSUITE_CONSUMER_SECRET");
  const tokenId = requerido("NETSUITE_TOKEN_ID");
  const tokenSecret = requerido("NETSUITE_TOKEN_SECRET");

  const oauthParams: Record<string, string> = {
    oauth_consumer_key: consumerKey,
    oauth_token: tokenId,
    oauth_signature_method: "HMAC-SHA256",
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_nonce: crypto.randomBytes(16).toString("hex"),
    oauth_version: "1.0",
  };

  const parametrosFirmados = Object.entries(oauthParams)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([k, v]) => `${percentEncode(k)}=${percentEncode(v)}`)
    .join("&");

  const baseString = [
    method.toUpperCase(),
    percentEncode(url),
    percentEncode(parametrosFirmados),
  ].join("&");

  const signingKey = `${percentEncode(consumerSecret)}&${percentEncode(tokenSecret)}`;
  const signature = crypto
    .createHmac("sha256", signingKey)
    .update(baseString)
    .digest("base64");

  const realm = accountId.toUpperCase().replace(/-/g, "_");
  const authParams = { ...oauthParams, oauth_signature: signature };

  return (
    `OAuth realm="${realm}", ` +
    Object.entries(authParams)
      .map(([k, v]) => `${percentEncode(k)}="${percentEncode(v)}"`)
      .join(", ")
  );
}

async function postRecord(
  recordType: "purchaseorder" | "salesorder",
  body: Record<string, unknown>,
): Promise<{ id: string; tranId: string }> {
  const accountId = requerido("NETSUITE_ACCOUNT_ID");
  const createUrl = `https://${accountId}.suitetalk.api.netsuite.com/services/rest/record/v1/${recordType}`;

  const createResponse = await fetch(createUrl, {
    method: "POST",
    headers: {
      Authorization: firmarSolicitudTBA("POST", createUrl),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!createResponse.ok) {
    throw new Error(
      `NetSuite rechazó la orden (${createResponse.status}): ${await createResponse.text()}`,
    );
  }

  const location = createResponse.headers.get("Location");
  if (!location) {
    throw new Error("NetSuite no devolvió la ubicación de la orden creada.");
  }

  const getResponse = await fetch(location, {
    headers: { Authorization: firmarSolicitudTBA("GET", location) },
  });
  if (!getResponse.ok) {
    throw new Error(
      `No se pudo leer la orden recién creada en NetSuite (${getResponse.status}).`,
    );
  }

  const record = (await getResponse.json()) as { id: string; tranId: string };
  return { id: record.id, tranId: record.tranId };
}

export function construirPayloadOrdenCompra(input: {
  netsuiteVendorId: string;
  netsuiteItemId: string;
  netoKg: number;
  precioUnitarioKg: number;
  subsidiaryId: string;
}) {
  return {
    entity: { id: input.netsuiteVendorId },
    subsidiary: { id: input.subsidiaryId },
    item: {
      items: [
        { item: { id: input.netsuiteItemId }, quantity: input.netoKg, rate: input.precioUnitarioKg },
      ],
    },
  };
}

export function construirPayloadOrdenVenta(input: {
  netsuiteCustomerId: string;
  netsuiteItemId: string;
  pesoKg: number;
  precioUnitarioKg: number;
  subsidiaryId: string;
}) {
  return {
    entity: { id: input.netsuiteCustomerId },
    subsidiary: { id: input.subsidiaryId },
    item: {
      items: [
        { item: { id: input.netsuiteItemId }, quantity: input.pesoKg, rate: input.precioUnitarioKg },
      ],
    },
  };
}

export async function crearOrdenCompra(input: {
  netsuiteVendorId: string;
  netsuiteItemId: string;
  netoKg: number;
  precioUnitarioKg: number;
}): Promise<{ id: string; tranId: string }> {
  const subsidiaryId = requerido("NETSUITE_SUBSIDIARY_ID");
  const payload = construirPayloadOrdenCompra({ ...input, subsidiaryId });
  return postRecord("purchaseorder", payload);
}

export async function crearOrdenVenta(input: {
  netsuiteCustomerId: string;
  netsuiteItemId: string;
  pesoKg: number;
  precioUnitarioKg: number;
}): Promise<{ id: string; tranId: string }> {
  const subsidiaryId = requerido("NETSUITE_SUBSIDIARY_ID");
  const payload = construirPayloadOrdenVenta({ ...input, subsidiaryId });
  return postRecord("salesorder", payload);
}
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `npx tsx --test src/lib/netsuite.test.ts`
Expected: PASS — 3 tests, 0 fallas.

- [ ] **Step 5: Agregar el archivo al script `test` de `package.json`**

En `package.json`, reemplazar:

```json
    "test": "tsx --test src/lib/tolerancia.test.ts"
```

por:

```json
    "test": "tsx --test src/lib/tolerancia.test.ts src/lib/netsuite.test.ts"
```

- [ ] **Step 6: Correr la suite completa**

Run: `npm run test`
Expected: PASS — todos los tests de `tolerancia.test.ts` y `netsuite.test.ts`.

- [ ] **Step 7: Commit**

```bash
git add src/lib/netsuite.ts src/lib/netsuite.test.ts package.json
git commit -m "Agregar capa de API NetSuite (TBA + REST Record API) con self-check"
```

---

## Task 3: Campo de ID de NetSuite en catálogos (Proveedor, Cliente, Articulo)

**Files:**
- Modify: `src/lib/validations/catalogos.ts:9-21`
- Modify: `src/app/(app)/catalogos/proveedores/actions.ts:16-36`
- Modify: `src/app/(app)/catalogos/proveedores/[id]/page.tsx:29-42`
- Modify: `src/app/(app)/catalogos/clientes/actions.ts:16-36`
- Modify: `src/app/(app)/catalogos/clientes/[id]/page.tsx:29-42`
- Modify: `src/app/(app)/catalogos/articulos/actions.ts:17-34`
- Modify: `src/app/(app)/catalogos/articulos/[id]/page.tsx:29-31`

**Interfaces:**
- Produces: formularios de Proveedor/Cliente/Articulo que capturan y persisten `netsuiteVendorId`/`netsuiteCustomerId`/`netsuiteItemId`, consumidos por las Server Actions de las Tasks 4 y 5.

- [ ] **Step 1: Extender los esquemas Zod**

En `src/lib/validations/catalogos.ts`, reemplazar:

```ts
const nombreRfcTelefonoSchema = z.object({
  nombre: z.string().min(1, { error: "Requerido" }).trim(),
  rfc: z.string().trim().nullish(),
  telefono: z.string().trim().nullish(),
});
export const proveedorSchema = nombreRfcTelefonoSchema;
export const clienteSchema = nombreRfcTelefonoSchema;

const nombreSchema = z.object({
  nombre: z.string().min(1, { error: "Requerido" }).trim(),
});
export const articuloSchema = nombreSchema;
export const unidadEmpaqueSchema = nombreSchema;
```

por:

```ts
const nombreRfcTelefonoSchema = z.object({
  nombre: z.string().min(1, { error: "Requerido" }).trim(),
  rfc: z.string().trim().nullish(),
  telefono: z.string().trim().nullish(),
});
export const proveedorSchema = nombreRfcTelefonoSchema.extend({
  netsuiteVendorId: z.string().trim().nullish(),
});
export const clienteSchema = nombreRfcTelefonoSchema.extend({
  netsuiteCustomerId: z.string().trim().nullish(),
});

const nombreSchema = z.object({
  nombre: z.string().min(1, { error: "Requerido" }).trim(),
});
export const articuloSchema = nombreSchema.extend({
  netsuiteItemId: z.string().trim().nullish(),
});
export const unidadEmpaqueSchema = nombreSchema;
```

- [ ] **Step 2: Persistir el campo en `saveProveedor`**

En `src/app/(app)/catalogos/proveedores/actions.ts`, reemplazar:

```ts
  const validated = proveedorSchema.safeParse({
    nombre: formData.get("nombre"),
    rfc: formData.get("rfc"),
    telefono: formData.get("telefono"),
  });
  if (!validated.success) {
    return { errors: validated.error.flatten().fieldErrors };
  }

  const id = formData.get("id");
  const data = {
    nombre: validated.data.nombre,
    rfc: validated.data.rfc || null,
    telefono: validated.data.telefono || null,
  };
```

por:

```ts
  const validated = proveedorSchema.safeParse({
    nombre: formData.get("nombre"),
    rfc: formData.get("rfc"),
    telefono: formData.get("telefono"),
    netsuiteVendorId: formData.get("netsuiteVendorId"),
  });
  if (!validated.success) {
    return { errors: validated.error.flatten().fieldErrors };
  }

  const id = formData.get("id");
  const data = {
    nombre: validated.data.nombre,
    rfc: validated.data.rfc || null,
    telefono: validated.data.telefono || null,
    netsuiteVendorId: validated.data.netsuiteVendorId || null,
  };
```

- [ ] **Step 3: Agregar el campo al formulario de Proveedor**

En `src/app/(app)/catalogos/proveedores/[id]/page.tsx`, reemplazar:

```tsx
        defaultValues={
          proveedor
            ? {
                nombre: proveedor.nombre,
                rfc: proveedor.rfc ?? "",
                telefono: proveedor.telefono ?? "",
              }
            : undefined
        }
        fields={[
          { name: "nombre", label: "Nombre", required: true },
          { name: "rfc", label: "RFC" },
          { name: "telefono", label: "Teléfono" },
        ]}
```

por:

```tsx
        defaultValues={
          proveedor
            ? {
                nombre: proveedor.nombre,
                rfc: proveedor.rfc ?? "",
                telefono: proveedor.telefono ?? "",
                netsuiteVendorId: proveedor.netsuiteVendorId ?? "",
              }
            : undefined
        }
        fields={[
          { name: "nombre", label: "Nombre", required: true },
          { name: "rfc", label: "RFC" },
          { name: "telefono", label: "Teléfono" },
          {
            name: "netsuiteVendorId",
            label: "ID de Vendor en NetSuite",
            helpText: "Opcional. Necesario para enviar sus Compras a NetSuite.",
          },
        ]}
```

- [ ] **Step 4: Persistir el campo en `saveCliente`**

En `src/app/(app)/catalogos/clientes/actions.ts`, reemplazar:

```ts
  const validated = clienteSchema.safeParse({
    nombre: formData.get("nombre"),
    rfc: formData.get("rfc"),
    telefono: formData.get("telefono"),
  });
  if (!validated.success) {
    return { errors: validated.error.flatten().fieldErrors };
  }

  const id = formData.get("id");
  const data = {
    nombre: validated.data.nombre,
    rfc: validated.data.rfc || null,
    telefono: validated.data.telefono || null,
  };
```

por:

```ts
  const validated = clienteSchema.safeParse({
    nombre: formData.get("nombre"),
    rfc: formData.get("rfc"),
    telefono: formData.get("telefono"),
    netsuiteCustomerId: formData.get("netsuiteCustomerId"),
  });
  if (!validated.success) {
    return { errors: validated.error.flatten().fieldErrors };
  }

  const id = formData.get("id");
  const data = {
    nombre: validated.data.nombre,
    rfc: validated.data.rfc || null,
    telefono: validated.data.telefono || null,
    netsuiteCustomerId: validated.data.netsuiteCustomerId || null,
  };
```

- [ ] **Step 5: Agregar el campo al formulario de Cliente**

En `src/app/(app)/catalogos/clientes/[id]/page.tsx`, reemplazar:

```tsx
        defaultValues={
          cliente
            ? {
                nombre: cliente.nombre,
                rfc: cliente.rfc ?? "",
                telefono: cliente.telefono ?? "",
              }
            : undefined
        }
        fields={[
          { name: "nombre", label: "Nombre", required: true },
          { name: "rfc", label: "RFC" },
          { name: "telefono", label: "Teléfono" },
        ]}
```

por:

```tsx
        defaultValues={
          cliente
            ? {
                nombre: cliente.nombre,
                rfc: cliente.rfc ?? "",
                telefono: cliente.telefono ?? "",
                netsuiteCustomerId: cliente.netsuiteCustomerId ?? "",
              }
            : undefined
        }
        fields={[
          { name: "nombre", label: "Nombre", required: true },
          { name: "rfc", label: "RFC" },
          { name: "telefono", label: "Teléfono" },
          {
            name: "netsuiteCustomerId",
            label: "ID de Customer en NetSuite",
            helpText: "Opcional. Necesario para enviar sus Ventas a NetSuite.",
          },
        ]}
```

- [ ] **Step 6: Extender el catálogo de Articulo**

En `src/app/(app)/catalogos/articulos/actions.ts`, reemplazar:

```ts
  const validated = articuloSchema.safeParse({
    nombre: formData.get("nombre"),
  });
  if (!validated.success) {
    return { errors: validated.error.flatten().fieldErrors };
  }

  const id = formData.get("id");

  try {
    if (id) {
      await prisma.articulo.update({
        where: { id: Number(id) },
        data: validated.data,
      });
    } else {
      await prisma.articulo.create({ data: validated.data });
    }
  } catch (error) {
```

por:

```ts
  const validated = articuloSchema.safeParse({
    nombre: formData.get("nombre"),
    netsuiteItemId: formData.get("netsuiteItemId"),
  });
  if (!validated.success) {
    return { errors: validated.error.flatten().fieldErrors };
  }

  const id = formData.get("id");
  const data = {
    nombre: validated.data.nombre,
    netsuiteItemId: validated.data.netsuiteItemId || null,
  };

  try {
    if (id) {
      await prisma.articulo.update({ where: { id: Number(id) }, data });
    } else {
      await prisma.articulo.create({ data });
    }
  } catch (error) {
```

En `src/app/(app)/catalogos/articulos/[id]/page.tsx`, reemplazar:

```tsx
        defaultValues={articulo ? { nombre: articulo.nombre } : undefined}
        fields={[{ name: "nombre", label: "Nombre", required: true }]}
```

por:

```tsx
        defaultValues={
          articulo
            ? { nombre: articulo.nombre, netsuiteItemId: articulo.netsuiteItemId ?? "" }
            : undefined
        }
        fields={[
          { name: "nombre", label: "Nombre", required: true },
          {
            name: "netsuiteItemId",
            label: "ID de Item en NetSuite",
            helpText: "Opcional. Artículo inventariable en NetSuite, sin lotificación.",
          },
        ]}
```

- [ ] **Step 7: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 8: Verificación manual**

Run: `npm run dev` (usar Node ≥20.9, ver `.nvmrc`), abrir `http://localhost:3000/catalogos/proveedores/nuevo` y confirmar que aparece el campo "ID de Vendor en NetSuite"; repetir para `/catalogos/clientes/nuevo` y `/catalogos/articulos/nuevo`.

- [ ] **Step 9: Commit**

```bash
git add src/lib/validations/catalogos.ts src/app/\(app\)/catalogos/proveedores src/app/\(app\)/catalogos/clientes src/app/\(app\)/catalogos/articulos
git commit -m "Agregar campo de ID de NetSuite a catálogos de Proveedor, Cliente y Articulo"
```

---

## Task 4: Enviar Compra a NetSuite (Server Action + UI)

**Files:**
- Modify: `src/app/(app)/compras/[id]/actions.ts`
- Modify: `src/app/(app)/compras/[id]/page.tsx`

**Interfaces:**
- Consumes: `crearOrdenCompra` de `src/lib/netsuite.ts` (Task 2), `registrarAuditLog` de `src/lib/audit.ts`, `EstadoBadge`/`CatalogForm` ya importados en la página.
- Produces: Server Action `enviarCompraANetSuite`, exportada para su uso en `page.tsx`.

- [ ] **Step 1: Agregar la Server Action**

En `src/app/(app)/compras/[id]/actions.ts`, agregar el import y la función al final del archivo:

```ts
import { crearOrdenCompra } from "@/lib/netsuite";
```

(agregar junto a los demás imports, al inicio del archivo)

```ts
export async function enviarCompraANetSuite(
  _state: CatalogFormState,
  formData: FormData,
): Promise<CatalogFormState> {
  const usuario = await requireRole(["ADMIN", "SUPERVISOR"]);

  const id = Number(formData.get("id"));
  const compra = await prisma.compra.findUnique({
    where: { id },
    include: { proveedor: true, pesaje: { include: { articulo: true } } },
  });
  if (!compra) return { message: "Compra no encontrada." };
  if (compra.estado === "CANCELADA") {
    return { message: "No se puede enviar a NetSuite una compra cancelada." };
  }
  if (compra.netsuiteOrderId) {
    return { message: "Esta compra ya fue enviada a NetSuite." };
  }
  if (!compra.proveedor.netsuiteVendorId) {
    return {
      message: `Falta configurar el ID de NetSuite del proveedor "${compra.proveedor.nombre}".`,
    };
  }
  if (!compra.pesaje.articulo?.netsuiteItemId) {
    return {
      message: `Falta configurar el ID de NetSuite del artículo "${compra.pesaje.articulo?.nombre ?? ""}".`,
    };
  }

  let orden: { id: string; tranId: string };
  try {
    orden = await crearOrdenCompra({
      netsuiteVendorId: compra.proveedor.netsuiteVendorId,
      netsuiteItemId: compra.pesaje.articulo.netsuiteItemId,
      netoKg: Number(compra.pesaje.netoKg ?? 0),
      precioUnitarioKg: Number(compra.precioUnitarioKg),
    });
  } catch (error) {
    return {
      message: error instanceof Error ? error.message : "Error al enviar la compra a NetSuite.",
    };
  }

  await prisma.compra.update({
    where: { id },
    data: {
      netsuiteOrderId: orden.id,
      netsuiteOrderNumber: orden.tranId,
      netsuiteSyncedAt: new Date(),
    },
  });

  await registrarAuditLog({
    entidad: "Compra",
    entidadId: id,
    accion: "COMPRA_ENVIADA_NETSUITE",
    usuarioId: usuario.id,
    detalleNuevo: { netsuiteOrderId: orden.id, netsuiteOrderNumber: orden.tranId },
  });

  revalidatePath(`/compras/${id}`);
  redirect(`/compras/${id}`);
}
```

- [ ] **Step 2: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 3: Agregar el indicador y el botón en la página de detalle**

En `src/app/(app)/compras/[id]/page.tsx`, reemplazar el import de acciones:

```ts
import { corregirCompra, eliminarCompra, anularCompra } from "./actions";
```

por:

```ts
import { corregirCompra, eliminarCompra, anularCompra, enviarCompraANetSuite } from "./actions";
```

Reemplazar:

```tsx
  const asignado =
    compra.lote?.movimientos.reduce((s, m) => s + Number(m.pesoAsignadoKg), 0) ?? 0;
  const puedeAnularOEliminar =
    usuario.role === "ADMIN" && asignado === 0 && compra.estado !== "CANCELADA";
```

por:

```tsx
  const asignado =
    compra.lote?.movimientos.reduce((s, m) => s + Number(m.pesoAsignadoKg), 0) ?? 0;
  const puedeAnularOEliminar =
    usuario.role === "ADMIN" && asignado === 0 && compra.estado !== "CANCELADA";
  const puedeEnviarANetSuite =
    (usuario.role === "ADMIN" || usuario.role === "SUPERVISOR") &&
    compra.estado !== "CANCELADA" &&
    !compra.netsuiteOrderId;
  const faltaMapeoNetSuite =
    !compra.proveedor.netsuiteVendorId || !compra.pesaje.articulo?.netsuiteItemId;
```

Reemplazar la fila del `<dl>` de "Lote":

```tsx
          <dt className="text-muted">Lote</dt>
          <dd>
            {compra.lote ? (
              <Link href={`/lotes/${compra.lote.id}`} className={buttonClass("link")}>
                {compra.lote.folio}
              </Link>
            ) : (
              "—"
            )}
          </dd>
        </dl>
      </Card>
```

por:

```tsx
          <dt className="text-muted">Lote</dt>
          <dd>
            {compra.lote ? (
              <Link href={`/lotes/${compra.lote.id}`} className={buttonClass("link")}>
                {compra.lote.folio}
              </Link>
            ) : (
              "—"
            )}
          </dd>
          <dt className="text-muted">NetSuite</dt>
          <dd>
            {compra.netsuiteOrderId ? (
              <EstadoBadge label={`Enviada — ${compra.netsuiteOrderNumber}`} tone="positive" />
            ) : (
              "—"
            )}
          </dd>
        </dl>
      </Card>

      {puedeEnviarANetSuite && (
        <Card>
          {faltaMapeoNetSuite ? (
            <p className="text-sm text-muted">
              Falta configurar el ID de NetSuite del proveedor o del artículo antes de poder
              enviar esta compra como Orden de Compra.
            </p>
          ) : (
            <CatalogForm
              action={enviarCompraANetSuite}
              submitLabel="Enviar a NetSuite"
              hiddenId={compra.id}
              confirmMessage={`¿Enviar esta compra como Orden de Compra a NetSuite? Proveedor ${compra.proveedor.nombre}, importe $${compra.importeTotal.toString()}.`}
              fields={[]}
            />
          )}
        </Card>
      )}
```

- [ ] **Step 4: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 5: Verificación manual (sin credenciales reales de NetSuite todavía)**

Run: `npm run dev`, abrir el detalle de una Compra existente como ADMIN. Confirmar: aparece la fila "NetSuite: —", y aparece el mensaje "Falta configurar el ID de NetSuite..." (porque el Proveedor/Articulo de prueba aún no tienen IDs capturados). Asignar un ID de prueba al Proveedor y al Articulo desde catálogos, recargar: ahora debe aparecer el botón "Enviar a NetSuite" con su diálogo de confirmación (el envío real fallará sin credenciales — se verifica en la Task 6).

- [ ] **Step 6: Commit**

```bash
git add src/app/\(app\)/compras/\[id\]/actions.ts src/app/\(app\)/compras/\[id\]/page.tsx
git commit -m "Agregar envío de Compra a NetSuite (botón + indicador)"
```

---

## Task 5: Enviar Venta a NetSuite (Server Action + UI)

**Files:**
- Modify: `src/app/(app)/ventas/[id]/actions.ts`
- Modify: `src/app/(app)/ventas/[id]/page.tsx`

**Interfaces:**
- Consumes: `crearOrdenVenta` de `src/lib/netsuite.ts` (Task 2), `registrarAuditLog`, `VentaFormState` ya definido en `actions.ts`.
- Produces: Server Action `enviarVentaANetSuite`, exportada para su uso en `page.tsx`.

- [ ] **Step 1: Agregar la Server Action**

En `src/app/(app)/ventas/[id]/actions.ts`, agregar el import junto a los demás:

```ts
import { crearOrdenVenta } from "@/lib/netsuite";
```

Agregar al final del archivo:

```ts
export async function enviarVentaANetSuite(
  _state: VentaFormState,
  formData: FormData,
): Promise<VentaFormState> {
  const usuario = await requireRole(["ADMIN", "SUPERVISOR"]);

  const id = Number(formData.get("id"));
  const venta = await prisma.venta.findUnique({
    where: { id },
    include: { cliente: true, articulo: true },
  });
  if (!venta) return { message: "Venta no encontrada." };
  if (!canAccessUbicacion(usuario, venta.ubicacionId)) {
    return { message: "Venta no encontrada." };
  }
  if (venta.estado !== "CERRADA") {
    return { message: "Solo se pueden enviar a NetSuite ventas cerradas." };
  }
  if (venta.netsuiteOrderId) {
    return { message: "Esta venta ya fue enviada a NetSuite." };
  }
  if (!venta.cliente.netsuiteCustomerId) {
    return {
      message: `Falta configurar el ID de NetSuite del cliente "${venta.cliente.nombre}".`,
    };
  }
  if (!venta.articulo.netsuiteItemId) {
    return {
      message: `Falta configurar el ID de NetSuite del artículo "${venta.articulo.nombre}".`,
    };
  }

  let orden: { id: string; tranId: string };
  try {
    orden = await crearOrdenVenta({
      netsuiteCustomerId: venta.cliente.netsuiteCustomerId,
      netsuiteItemId: venta.articulo.netsuiteItemId,
      pesoKg: Number(venta.pesoReportadoClienteKg ?? 0),
      precioUnitarioKg: Number(venta.precioUnitarioKg),
    });
  } catch (error) {
    return {
      message: error instanceof Error ? error.message : "Error al enviar la venta a NetSuite.",
    };
  }

  await prisma.venta.update({
    where: { id },
    data: {
      netsuiteOrderId: orden.id,
      netsuiteOrderNumber: orden.tranId,
      netsuiteSyncedAt: new Date(),
    },
  });

  await registrarAuditLog({
    entidad: "Venta",
    entidadId: id,
    accion: "VENTA_ENVIADA_NETSUITE",
    usuarioId: usuario.id,
    detalleNuevo: { netsuiteOrderId: orden.id, netsuiteOrderNumber: orden.tranId },
  });

  revalidatePath(`/ventas/${id}`);
  redirect(`/ventas/${id}`);
}
```

- [ ] **Step 2: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 3: Agregar el indicador y el botón en la página de detalle**

En `src/app/(app)/ventas/[id]/page.tsx`, reemplazar el import de acciones:

```tsx
import { aprobarExcepcionTolerancia, corregirVenta, eliminarVenta } from "./actions";
```

por:

```tsx
import {
  aprobarExcepcionTolerancia,
  corregirVenta,
  eliminarVenta,
  enviarVentaANetSuite,
} from "./actions";
```

Reemplazar:

```tsx
  const puedeAprobar = usuario.role === "ADMIN" || usuario.role === "SUPERVISOR";
  const pendiente = venta.estado === "PENDIENTE_APROBACION";
```

por:

```tsx
  const puedeAprobar = usuario.role === "ADMIN" || usuario.role === "SUPERVISOR";
  const pendiente = venta.estado === "PENDIENTE_APROBACION";
  const puedeEnviarANetSuite =
    (usuario.role === "ADMIN" || usuario.role === "SUPERVISOR") &&
    venta.estado === "CERRADA" &&
    !venta.netsuiteOrderId;
  const faltaMapeoNetSuite = !venta.cliente.netsuiteCustomerId || !venta.articulo.netsuiteItemId;
```

Reemplazar la fila del `<dl>` de "Importe":

```tsx
          <dt className="text-muted">Importe</dt>
          <dd className="font-semibold">${venta.importeTotal.toString()}</dd>
          {venta.pesoReportadoClienteKg && (
```

por:

```tsx
          <dt className="text-muted">Importe</dt>
          <dd className="font-semibold">${venta.importeTotal.toString()}</dd>
          <dt className="text-muted">NetSuite</dt>
          <dd>
            {venta.netsuiteOrderId ? (
              <EstadoBadge label={`Enviada — ${venta.netsuiteOrderNumber}`} tone="positive" />
            ) : (
              "—"
            )}
          </dd>
          {venta.pesoReportadoClienteKg && (
```

Agregar el bloque del botón justo antes del bloque de acciones ADMIN existente. Reemplazar:

```tsx
      {usuario.role === "ADMIN" && venta.estado !== "CANCELADA" && (
        <div className="flex flex-wrap gap-2">
          <ActionDialog
            label="Corregir"
```

por:

```tsx
      {puedeEnviarANetSuite && (
        <Card>
          {faltaMapeoNetSuite ? (
            <p className="text-sm text-muted">
              Falta configurar el ID de NetSuite del cliente o del artículo antes de poder
              enviar esta venta como Orden de Venta.
            </p>
          ) : (
            <CatalogForm
              action={enviarVentaANetSuite}
              submitLabel="Enviar a NetSuite"
              hiddenId={venta.id}
              confirmMessage={`¿Enviar esta venta como Orden de Venta a NetSuite? Cliente ${venta.cliente.nombre}, importe $${venta.importeTotal.toString()}.`}
              fields={[]}
            />
          )}
        </Card>
      )}

      {usuario.role === "ADMIN" && venta.estado !== "CANCELADA" && (
        <div className="flex flex-wrap gap-2">
          <ActionDialog
            label="Corregir"
```

- [ ] **Step 4: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 5: Verificación manual**

Run: `npm run dev`, abrir el detalle de una Venta `CERRADA` como ADMIN. Confirmar: fila "NetSuite: —", mensaje de mapeo faltante si el Cliente/Articulo no tienen ID; tras capturarlos, aparece el botón "Enviar a NetSuite" con confirmación.

- [ ] **Step 6: Commit**

```bash
git add src/app/\(app\)/ventas/\[id\]/actions.ts src/app/\(app\)/ventas/\[id\]/page.tsx
git commit -m "Agregar envío de Venta a NetSuite (botón + indicador)"
```

---

## Task 6: Variables de entorno, verificación end-to-end y limpieza

**Files:**
- Modify: `.env.production.example`

**Interfaces:**
- Consumes: nada nuevo — cierra el ciclo documentando cómo desplegar lo construido en las Tasks 1-5.

- [ ] **Step 1: Documentar las variables de entorno de producción**

En `.env.production.example`, agregar después del bloque de `ANTHROPIC_API_KEY`:

```
# Credenciales de NetSuite (Token-Based Authentication) para crear Órdenes
# de Compra/Venta desde el detalle de Compra/Venta. Generar el Access Token
# en NetSuite: Setup → Users/Roles → Access Tokens, ligado a un usuario/rol
# de integración con permiso de crear Purchase Order / Sales Order.
NETSUITE_ACCOUNT_ID="1234567-sb1"
NETSUITE_CONSUMER_KEY="..."
NETSUITE_CONSUMER_SECRET="..."
NETSUITE_TOKEN_ID="..."
NETSUITE_TOKEN_SECRET="..."
# ID de la subsidiaria de NetSuite a la que se asignan todas las órdenes
# (PRO MERC PUEBLA = 14 en la cuenta actual).
NETSUITE_SUBSIDIARY_ID="14"
```

- [ ] **Step 2: Correr toda la suite de tests**

Run: `npm run test`
Expected: PASS.

- [ ] **Step 3: Lint**

Run: `npm run lint`
Expected: sin errores.

- [ ] **Step 4: Type check completo**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 5: Build de producción**

Run: `npm run build`
Expected: build exitoso (confirma que las Server Actions y el nuevo módulo compilan en modo producción).

- [ ] **Step 6: Verificación manual contra NetSuite sandbox**

Con credenciales reales de un sandbox de NetSuite temporalmente en `.env` local: capturar el ID de Vendor/Item de prueba en un Proveedor/Articulo real, crear o usar una Compra existente, hacer click en "Enviar a NetSuite", confirmar. Verificar en la UI de NetSuite que la Purchase Order se creó con el vendor, subsidiaria e ítem correctos y sin campo de lote. Repetir para una Venta `CERRADA` (Sales Order). Quitar las credenciales de `.env` local al terminar (no deben quedar commiteadas).

- [ ] **Step 7: Commit**

```bash
git add .env.production.example
git commit -m "Documentar variables de entorno de NetSuite para producción"
```
