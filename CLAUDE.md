# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Project

PROMERC — trazabilidad de compra-venta de desperdicio (cartón, etc.) por peso, operado desde báscula, para reemplazar el control en papel. Flujo central: **Pesaje** (tara + neto en báscula, con evidencia fotográfica y firmas digitales) → **Compra** (a un Proveedor, agrupada en un **Lote** diario por ubicación/artículo) → **Venta** (a un Cliente, consumiendo uno o varios lotes) con validación automática de tolerancia entre lo comprado y lo reportado por el cliente, bloqueando el cierre si la diferencia excede el umbral hasta que un supervisor la apruebe.

Ver `DEPLOY.md` para el runbook de despliegue en cPanel.

## Commands

```bash
npm run dev              # dev server (localhost:3000)
npm run build            # build de producción; el postbuild arma deploy/ (ver DEPLOY.md)
npm run start             # next start (requiere node_modules completo)
npm run start:standalone  # corre deploy/server.js, igual que en producción
npm run lint              # eslint (flat config, eslint-config-next)
npm run test               # self-check de la lógica de tolerancia (node:test vía tsx)
```

### Prisma

```bash
npx prisma generate                    # regenera el cliente en src/generated/prisma (gitignored)
npx prisma migrate dev --name <desc>   # crear + aplicar migración en desarrollo
npx prisma migrate deploy              # aplicar migraciones ya creadas, en producción
npx prisma db seed                     # corre prisma/seed.ts (ubicación, admin, artículo base, tolerancia global)
```

- Schema: `prisma/schema.prisma`. Datasource PostgreSQL (dev y producción — SQLite no soporta bien `Decimal`/`Json` y la concurrencia multi-ubicación necesita multi-writer real).
- Generador `prisma-client` (no `prisma-client-js`) con `output = "../src/generated/prisma"`. Importar de `@/generated/prisma`, no de `@prisma/client`.
- Prisma 7 ya no acepta `url` dentro de `datasource` en el schema — la URL vive en `prisma.config.ts` (para Migrate) y el cliente en runtime recibe la conexión vía un **driver adapter** (`@prisma/adapter-pg` + `pg`), instanciado una sola vez en `src/lib/db.ts`. Cualquier código que necesite la base importa `prisma` desde ahí, nunca crea su propio `PrismaClient`.
- Config en `prisma.config.ts` (enfoque de archivo de Prisma 7), incluye el comando de seed.

## Arquitectura

- App Router bajo `src/app`. Alias `@/*` → `./src/*`.
- **`(auth)`**: rutas públicas — login, recuperación de contraseña (token de un solo uso, correo vía `src/lib/email.ts`; sin SMTP configurado, el link se imprime en consola).
- **`(app)`**: todo lo protegido. El layout raíz llama `getCurrentUser()`; cada subcarpeta (`catalogos`, `pesajes`, `compras`, `lotes`, `ventas`, `reportes`) tiene su propio `layout.tsx` con `requireRole([...])` — ver `src/lib/auth/dal.ts`. `catalogos/usuarios` además exige ADMIN dentro de la propia página/acción (más estricto que el resto de catálogos).
- **Auth**: sesión JWT stateless (`jose`) en cookie httpOnly, hash de contraseñas con `argon2`. `src/proxy.ts` solo hace el redirect optimista por presencia de cookie; `src/lib/auth/dal.ts` (`verifySession`/`getCurrentUser`/`requireRole`) es la única fuente real de autorización y se llama al inicio de cada Server Action y Route Handler — no asumir que una página protegida por su layout es suficiente si se agrega una acción nueva.
- **Modelo de datos** (`prisma/schema.prisma`): `Pesaje` (dos tiempos: tara y neto, con `PesajeEmpaque` para conteo de pacas) → `Compra` (1:1 con `Pesaje`, N:1 con `Lote`) → `Lote` (folio `L-YYYYMMDD-###` autogenerado por día/ubicación/artículo en `src/lib/lote.ts`, corregible con auditoría) → `Venta` (vía `LoteMovimiento`, N:M con `Lote`). `Firma` y `Evidencia` son polimórficas (FK opcional a `Pesaje` o `Venta`, nunca ambas). `AuditLog` genérico para correcciones (folio de lote, aprobación de tolerancia).
- **Tolerancia**: `src/lib/tolerancia.ts` tiene las funciones puras (con self-check en `tolerancia.test.ts`); el umbral sale de `ToleranciaConfig` (override por artículo, o `articuloId: null` como default global). Si se excede, la `Venta` queda en `PENDIENTE_APROBACION` hasta que un ADMIN/SUPERVISOR la apruebe (crea una `Firma` tipo `EXCEPCION_TOLERANCIA` + registro en `AuditLog`).
- **Firmas digitales**: `src/components/signature-pad.tsx`, un `<canvas>` nativo (sin librería) que serializa a data URL PNG; el servidor lo decodifica con `saveDataUrl` en `src/lib/storage.ts`.
- **Archivos subidos** (fotos de ticket, comprobantes, firmas): `src/lib/storage.ts` guarda en disco bajo `STORAGE_ROOT` (por defecto `./storage` en dev; **debe** apuntar fuera de la carpeta de build en producción, ver `DEPLOY.md`) y se sirven solo autenticados vía `/api/evidencia/[id]` y `/api/firmas/[id]`, que verifican que el usuario tenga acceso a la ubicación del registro (`canAccessUbicacion` en `dal.ts`).
- **Componentes compartidos de formularios**: `src/components/catalog-form.tsx` (formulario genérico dirigido por config, usado por catálogos, pesajes, compras, lotes, ventas) y `src/components/catalog-table.tsx` (listado con toggle activo/inactivo). Antes de construir un formulario nuevo, revisar si encaja en estos dos antes de escribir uno a la medida — solo pesajes y ventas tienen formularios propios (`cerrar-pesaje-form.tsx`, `reportar-peso-form.tsx`) porque manejan archivos/canvas que el genérico no cubre.
- **Reportes/exportación**: `src/lib/reportes.ts` (agregados de inventario y periodo) + `src/lib/export/excel.ts` (`buildWorkbook`, usa `xlsx`), consumidos por `/reportes` y las 3 rutas bajo `/api/exports/*`.
- Styling: Tailwind CSS v4 vía `@tailwindcss/postcss`, configurado en `src/app/globals.css` (sin `tailwind.config.*`).

## Patrones a seguir

- **Nunca usar `.bind()` en una Server Action que se pasa a `useActionState`** — en esta versión de Next (16.2.10, Turbopack dev) provoca un loop infinito real (memoria/CPU disparados) al reinvocar la misma acción una segunda vez en el proceso. Pasar cualquier dato adicional (ej. un token o id) como campo oculto del formulario en su lugar — ver `reset-form.tsx` o `cerrar-pesaje-form.tsx`.
- **Campos opcionales de formulario**: usar `.nullish()` en Zod, no `.optional()` — `formData.get()` devuelve `null` (no `undefined`) cuando un campo está ausente, y `.optional()` de Zod v4 no acepta `null`.
- Fuera de lo anterior, no hay guía genérica de "buenas prácticas" que agregar aquí — seguir el patrón del módulo más parecido ya construido.

## Importante: esta no es la versión de Next.js que conoces

Según `AGENTS.md`, la versión instalada de Next.js (`16.2.10`) tiene cambios que rompen supuestos de versiones anteriores. **Antes de escribir código de Next.js, leer la guía correspondiente en `node_modules/next/dist/docs/`** (organizado en `01-app`, `02-pages`, `03-architecture`, `04-community`) en vez de confiar en conocimiento previo, y seguir cualquier aviso de deprecación que aparezca ahí. Cambios ya verificados y relevantes para este repo: `middleware.ts` → `proxy.ts`; `cookies()`/`headers()` son async-only; Server Actions tienen límite de 1MB por defecto (subido a 10MB en `next.config.ts` para fotos); `datasource.url` ya no va en `schema.prisma` (ver arriba).
