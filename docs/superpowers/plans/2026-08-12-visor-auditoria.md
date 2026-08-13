# Visor de Auditoría Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir una página de solo lectura en `/auditoria` que muestre el contenido de `AuditLog` (ya se está llenando, pero nunca se ha mostrado), con filtros por fecha/entidad/acción/usuario, paginación y exportación a Excel.

**Architecture:** Server Component de Next.js (App Router), mismo patrón que `src/app/(app)/lotes/page.tsx` — filtros vía query params (`method="get"`), consulta directa con Prisma (`where`/`orderBy`/`skip`/`take`, sin ordenar en memoria porque todas las columnas son reales), tabla con los primitivos de UI ya existentes (`TableWrapper`, `ListPagination`, etc.). Acceso restringido con `requireRole` en un `layout.tsx` propio de la carpeta. Export a Excel en una route handler aparte, mismo patrón que `/api/exports/compras`.

**Tech Stack:** Next.js 16 App Router, Prisma 7 (`@/generated/prisma/client` vía `@/lib/db`), Tailwind (clases ya definidas en `src/components/ui/*`), `xlsx` vía `buildWorkbook`.

## Global Constraints

- Spec aprobado: `docs/superpowers/specs/2026-08-12-visor-auditoria-design.md` — cualquier duda sobre alcance, resolver ahí primero.
- Acceso: `ADMIN` y `SUPERVISOR` únicamente, sin scoping por ubicación (el spec explica por qué: `AuditLog` no tiene `ubicacionId` propio).
- **Sin test automatizado dedicado** (decisión explícita del spec, sección "Testing"): es una página de solo lectura sin lógica pura no trivial, igual que `/lotes` o `/compras` que tampoco tienen test propio. Cada tarea se verifica con `npx tsc --noEmit`, `npm run lint`, y una comprobación manual en el navegador (ya hay usuarios de prueba locales: `admin@promerc.local` / `operador.ecatepec@promerc.local`, password `test1234`, DB local en `postgresql://promerc:promerc_dev@localhost:5432/promerc_dev`).
- Alias de imports: `@/*` → `./src/*`.
- No usar `.bind()` en Server Actions — no aplica aquí (esta página no tiene Server Actions, solo un GET con query params).
- Campos opcionales de formulario: no aplica (no hay formularios de escritura en este visor).

---

## File Structure

- **Modificar** `src/lib/audit.ts` — agregar diccionario de labels de acción, set de acciones que borran el registro, y helper de ruta por entidad. Hoy solo tiene `registrarAuditLog()`.
- **Crear** `src/app/(app)/auditoria/layout.tsx` — control de acceso (`requireRole`).
- **Crear** `src/app/(app)/auditoria/page.tsx` — la página del visor (filtros, tabla, paginación).
- **Modificar** `src/app/(app)/layout.tsx` — agregar el link "Auditoría" al nav, condicionado a `ADMIN`/`SUPERVISOR`.
- **Crear** `src/app/api/exports/auditoria/route.ts` — export a Excel con los mismos filtros.

---

### Task 1: Constantes y helpers de auditoría

**Files:**
- Modify: `src/lib/audit.ts`

**Interfaces:**
- Consumes: nada nuevo (el archivo ya importa `prisma` y tipos de Prisma).
- Produces:
  - `ACCIONES_AUDITORIA: Record<string, string>` — mapa `accion` (string crudo de la BD) → label legible.
  - `ACCIONES_SIN_REGISTRO: Set<string>` — acciones cuyo `entidadId` ya no existe en la BD (delete real).
  - `rutaRegistro(entidad: string, entidadId: number): string | null` — ruta al detalle del registro, o `null` si la entidad no tiene ruta mapeada.

Estas tres cosas las van a usar tanto `auditoria/page.tsx` (Task 2) como `api/exports/auditoria/route.ts` (Task 4).

- [ ] **Step 1: Agregar las constantes y el helper al final de `src/lib/audit.ts`**

Archivo completo resultante (se agrega todo lo de abajo de `registrarAuditLog`, sin tocar lo que ya existe):

```ts
import "server-only";
import { prisma } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";

export async function registrarAuditLog(data: {
  entidad: string;
  entidadId: number;
  accion: string;
  usuarioId: number;
  detalleAnterior?: Record<string, unknown>;
  detalleNuevo?: Record<string, unknown>;
  motivo?: string;
}) {
  await prisma.auditLog.create({
    data: {
      entidad: data.entidad,
      entidadId: data.entidadId,
      accion: data.accion,
      usuarioId: data.usuarioId,
      detalleAnterior: data.detalleAnterior as Prisma.InputJsonValue | undefined,
      detalleNuevo: data.detalleNuevo as Prisma.InputJsonValue | undefined,
      motivo: data.motivo,
    },
  });
}

// Labels legibles para el visor de auditoría (src/app/(app)/auditoria) y su
// export a Excel. Si se agrega una acción nueva a algún registrarAuditLog()
// y no está aquí, el visor cae al valor crudo de `accion` como fallback —
// no oculta la fila.
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

// Acciones que borran el registro de la base (prisma.<entidad>.delete(),
// no un cambio de estado) — para estas no se debe ofrecer un link "Ver
// registro" en el visor, el entidadId ya no existe.
export const ACCIONES_SIN_REGISTRO = new Set([
  "VENTA_ELIMINADA",
  "COMPRA_ELIMINADA",
  "PESAJE_ELIMINADO",
]);

const RUTA_POR_ENTIDAD: Record<string, string> = {
  Lote: "/lotes",
  Venta: "/ventas",
  Compra: "/compras",
  Pesaje: "/pesajes",
};

export function rutaRegistro(entidad: string, entidadId: number): string | null {
  const base = RUTA_POR_ENTIDAD[entidad];
  return base ? `${base}/${entidadId}` : null;
}
```

- [ ] **Step 2: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sin errores (el archivo no se usa todavía en ningún lado, pero debe compilar solo).

- [ ] **Step 3: Commit**

```bash
git add src/lib/audit.ts
git commit -m "Agregar labels de acciones y helper de ruta para el visor de auditoría"
```

---

### Task 2: Página del visor + control de acceso

**Files:**
- Create: `src/app/(app)/auditoria/layout.tsx`
- Create: `src/app/(app)/auditoria/page.tsx`

**Interfaces:**
- Consumes:
  - `ACCIONES_AUDITORIA`, `ACCIONES_SIN_REGISTRO`, `rutaRegistro` de `@/lib/audit` (Task 1).
  - `requireRole` de `@/lib/auth/dal`.
  - `resolverRangoFecha`, `resolverPorPagina`, `OPCIONES_POR_PAGINA` de `@/lib/rango-fecha`.
  - `prisma` de `@/lib/db`.
  - `PageHeader` de `@/components/ui/card`; `buttonClass` de `@/components/ui/button`; `inputClass`, `labelClass` de `@/components/ui/field`; `TableWrapper`, `thClass`, `tdClass`, `trClass` de `@/components/ui/table`; `ListPagination` de `@/components/ui/list-pagination`.
- Produces: ruta `/auditoria` navegable, protegida por rol.

- [ ] **Step 1: Crear `src/app/(app)/auditoria/layout.tsx`**

```tsx
import { requireRole } from "@/lib/auth/dal";

export default async function AuditoriaLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  await requireRole(["ADMIN", "SUPERVISOR"]);
  return <>{children}</>;
}
```

- [ ] **Step 2: Crear `src/app/(app)/auditoria/page.tsx`**

```tsx
import Link from "next/link";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/ui/card";
import { buttonClass } from "@/components/ui/button";
import { inputClass, labelClass } from "@/components/ui/field";
import { TableWrapper, thClass, tdClass, trClass } from "@/components/ui/table";
import { ListPagination } from "@/components/ui/list-pagination";
import {
  resolverRangoFecha,
  resolverPorPagina,
  OPCIONES_POR_PAGINA,
} from "@/lib/rango-fecha";
import { ACCIONES_AUDITORIA, ACCIONES_SIN_REGISTRO, rutaRegistro } from "@/lib/audit";

const ENTIDADES = ["Lote", "Venta", "Compra", "Pesaje"];

export default async function AuditoriaPage({
  searchParams,
}: {
  searchParams: Promise<{
    desde?: string;
    hasta?: string;
    entidad?: string;
    accion?: string;
    usuarioId?: string;
    page?: string;
    perPage?: string;
  }>;
}) {
  const params = await searchParams;
  const { desde, hasta, desdeStr, hastaStr } = resolverRangoFecha(params.desde, params.hasta);
  const perPage = resolverPorPagina(params.perPage);
  const pagina = Math.max(1, Number(params.page) || 1);

  const entidad =
    params.entidad && ENTIDADES.includes(params.entidad) ? params.entidad : undefined;
  const accion =
    params.accion && params.accion in ACCIONES_AUDITORIA ? params.accion : undefined;
  const usuarioId = params.usuarioId ? Number(params.usuarioId) : undefined;

  const where = {
    createdAt: { gte: desde, lte: hasta },
    ...(entidad ? { entidad } : {}),
    ...(accion ? { accion } : {}),
    ...(usuarioId ? { usuarioId } : {}),
  };

  const [registros, total, usuariosDistintos] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      include: { usuario: { select: { nombre: true } } },
      orderBy: { createdAt: "desc" },
      skip: (pagina - 1) * perPage,
      take: perPage,
    }),
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({
      distinct: ["usuarioId"],
      select: { usuario: { select: { id: true, nombre: true } } },
      orderBy: { usuarioId: "asc" },
    }),
  ]);

  const totalPaginas = Math.max(1, Math.ceil(total / perPage));
  const paginaActual = Math.min(pagina, totalPaginas);

  const currentParams = new URLSearchParams({
    desde: desdeStr,
    hasta: hastaStr,
    perPage: perPage.toString(),
    page: paginaActual.toString(),
  });
  if (entidad) currentParams.set("entidad", entidad);
  if (accion) currentParams.set("accion", accion);
  if (usuarioId) currentParams.set("usuarioId", usuarioId.toString());

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Auditoría" />

      <form method="get" className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <label htmlFor="desde" className={labelClass}>
            Desde
          </label>
          <input
            id="desde"
            name="desde"
            type="date"
            defaultValue={desdeStr}
            className={inputClass}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="hasta" className={labelClass}>
            Hasta
          </label>
          <input
            id="hasta"
            name="hasta"
            type="date"
            defaultValue={hastaStr}
            className={inputClass}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="entidad" className={labelClass}>
            Entidad
          </label>
          <select
            id="entidad"
            name="entidad"
            defaultValue={entidad ?? ""}
            className={inputClass}
          >
            <option value="">Todas</option>
            {ENTIDADES.map((e) => (
              <option key={e} value={e}>
                {e}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="accion" className={labelClass}>
            Acción
          </label>
          <select id="accion" name="accion" defaultValue={accion ?? ""} className={inputClass}>
            <option value="">Todas</option>
            {Object.entries(ACCIONES_AUDITORIA).map(([valor, label]) => (
              <option key={valor} value={valor}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="usuarioId" className={labelClass}>
            Usuario
          </label>
          <select
            id="usuarioId"
            name="usuarioId"
            defaultValue={usuarioId?.toString() ?? ""}
            className={inputClass}
          >
            <option value="">Todos</option>
            {usuariosDistintos.map((r) => (
              <option key={r.usuario.id} value={r.usuario.id}>
                {r.usuario.nombre}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="perPage" className={labelClass}>
            Por página
          </label>
          <select id="perPage" name="perPage" defaultValue={perPage} className={inputClass}>
            {OPCIONES_POR_PAGINA.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>
        <button type="submit" className={buttonClass("secondary")}>
          Filtrar
        </button>
        <a
          href={`/api/exports/auditoria?${currentParams.toString()}`}
          className={buttonClass("link")}
        >
          Exportar a Excel
        </a>
      </form>

      <TableWrapper>
        <thead>
          <tr>
            <th className={thClass}>Fecha</th>
            <th className={thClass}>Usuario</th>
            <th className={thClass}>Entidad</th>
            <th className={thClass}>Acción</th>
            <th className={thClass}>Motivo</th>
            <th className={thClass} />
          </tr>
        </thead>
        <tbody>
          {registros.map((r) => {
            const ruta = ACCIONES_SIN_REGISTRO.has(r.accion)
              ? null
              : rutaRegistro(r.entidad, r.entidadId);
            const tieneDetalle = r.detalleAnterior !== null || r.detalleNuevo !== null;
            return (
              <tr key={r.id} className={trClass}>
                <td className={tdClass}>{r.createdAt.toLocaleString("es-MX")}</td>
                <td className={tdClass}>{r.usuario.nombre}</td>
                <td className={tdClass}>{r.entidad}</td>
                <td className={tdClass}>{ACCIONES_AUDITORIA[r.accion] ?? r.accion}</td>
                <td className={tdClass}>{r.motivo ?? "—"}</td>
                <td className={tdClass}>
                  <div className="flex flex-col items-start gap-1">
                    {ruta && (
                      <Link href={ruta} className={buttonClass("link")}>
                        Ver registro
                      </Link>
                    )}
                    {tieneDetalle && (
                      <details>
                        <summary className={`cursor-pointer ${buttonClass("link")}`}>
                          Ver detalle
                        </summary>
                        <pre className="mt-1 max-w-md overflow-x-auto whitespace-pre-wrap text-xs text-muted">
                          {JSON.stringify(
                            { antes: r.detalleAnterior, despues: r.detalleNuevo },
                            null,
                            2,
                          )}
                        </pre>
                      </details>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
          {registros.length === 0 && (
            <tr>
              <td colSpan={6} className={`${tdClass} text-center text-muted`}>
                Sin registros con estos filtros.
              </td>
            </tr>
          )}
        </tbody>
      </TableWrapper>

      <ListPagination
        pagina={paginaActual}
        totalPaginas={totalPaginas}
        total={total}
        etiqueta="registros"
        basePath="/auditoria"
        params={currentParams}
      />
    </div>
  );
}
```

- [ ] **Step 3: Verificar tipos y lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: sin errores. Si `tsc` marca la combinación `distinct` + `select` de la consulta `usuariosDistintos`, ajustar a dos pasos (primero `findMany({ distinct: ["usuarioId"], select: { usuarioId: true } })`, luego `prisma.usuario.findMany({ where: { id: { in: ids } } })`) — mantener el resto del archivo igual.

- [ ] **Step 4: Verificación manual en el navegador**

Con el servidor de dev corriendo (`npm run dev`, Node ≥20 vía `nvm use 22` si el Node del sistema es viejo) y la DB local (`postgresql://promerc:promerc_dev@localhost:5432/promerc_dev`):

1. Entra como `admin@promerc.local` (password `test1234`) y navega a `http://localhost:3000/auditoria` directo por URL (todavía no hay link en el nav, eso es la Task 3).
2. Confirma que carga la tabla con filtros arriba, sin errores en consola.
3. Prueba el filtro de fecha y de entidad, confirma que la URL refleja los query params y la tabla se actualiza.
4. Si hay algún registro con `detalleAnterior`/`detalleNuevo`, confirma que "Ver detalle" expande el JSON.
5. Cierra sesión, entra como `operador.ecatepec@promerc.local`, navega a `/auditoria` por URL directa — debe redirigir a `/` (por el `requireRole` del layout).

Expected: todo lo anterior se cumple sin errores en la terminal del dev server ni en la consola del navegador.

- [ ] **Step 5: Commit**

```bash
git add "src/app/(app)/auditoria/layout.tsx" "src/app/(app)/auditoria/page.tsx"
git commit -m "Agregar visor de auditoría en /auditoria (ADMIN/SUPERVISOR)"
```

---

### Task 3: Link de navegación

**Files:**
- Modify: `src/app/(app)/layout.tsx`

**Interfaces:**
- Consumes: nada nuevo — el archivo ya calcula `usuario.role` y arma el arreglo `links`.
- Produces: link "Auditoría" visible en el nav para `ADMIN`/`SUPERVISOR`, ausente para el resto.

- [ ] **Step 1: Agregar el link junto al de Catálogos**

En `src/app/(app)/layout.tsx`, el bloque de `links` termina así hoy (después de los cambios de la sesión de restricción de roles):

```tsx
          { href: "/mermas", label: "Mermas" },
          ...(usuario.role === "ADMIN" || usuario.role === "SUPERVISOR"
            ? [{ href: "/catalogos", label: "Catálogos" }]
            : []),
        ];
```

Reemplazar ese último bloque condicional por:

```tsx
          { href: "/mermas", label: "Mermas" },
          ...(usuario.role === "ADMIN" || usuario.role === "SUPERVISOR"
            ? [
                { href: "/catalogos", label: "Catálogos" },
                { href: "/auditoria", label: "Auditoría" },
              ]
            : []),
        ];
```

- [ ] **Step 2: Verificar tipos y lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: sin errores.

- [ ] **Step 3: Verificación manual en el navegador**

Con el servidor de dev corriendo: entra como `admin@promerc.local` y confirma que "Auditoría" aparece en el nav entre "Catálogos" y "Salir", y que da clic y navega a `/auditoria` correctamente. Entra como `operador.ecatepec@promerc.local` y confirma que el link NO aparece.

Expected: visible solo para ADMIN/SUPERVISOR, igual que Compras/Ventas/Catálogos.

- [ ] **Step 4: Commit**

```bash
git add "src/app/(app)/layout.tsx"
git commit -m "Agregar Auditoría al nav para ADMIN/SUPERVISOR"
```

---

### Task 4: Exportación a Excel

**Files:**
- Create: `src/app/api/exports/auditoria/route.ts`

**Interfaces:**
- Consumes: `requireRole` de `@/lib/auth/dal`; `prisma` de `@/lib/db`; `buildWorkbook` de `@/lib/export/excel`; `ACCIONES_AUDITORIA` de `@/lib/audit` (Task 1).
- Produces: `GET /api/exports/auditoria` — descarga `auditoria.xlsx`, mismos filtros que la página (`desde`, `hasta`, `entidad`, `accion`, `usuarioId` como query params).

- [ ] **Step 1: Crear `src/app/api/exports/auditoria/route.ts`**

```ts
import { requireRole } from "@/lib/auth/dal";
import { prisma } from "@/lib/db";
import { buildWorkbook } from "@/lib/export/excel";
import { ACCIONES_AUDITORIA } from "@/lib/audit";

export async function GET(request: Request) {
  await requireRole(["ADMIN", "SUPERVISOR"]);

  const { searchParams } = new URL(request.url);
  const desde = searchParams.get("desde");
  const hasta = searchParams.get("hasta");
  const entidad = searchParams.get("entidad");
  const accion = searchParams.get("accion");
  const usuarioIdParam = searchParams.get("usuarioId");

  const registros = await prisma.auditLog.findMany({
    where: {
      ...(desde && hasta
        ? {
            createdAt: {
              gte: new Date(`${desde}T00:00:00`),
              lte: new Date(`${hasta}T23:59:59`),
            },
          }
        : {}),
      ...(entidad ? { entidad } : {}),
      ...(accion ? { accion } : {}),
      ...(usuarioIdParam ? { usuarioId: Number(usuarioIdParam) } : {}),
    },
    include: { usuario: { select: { nombre: true } } },
    orderBy: { createdAt: "desc" },
  });

  const rows = registros.map((r) => ({
    Fecha: r.createdAt.toLocaleString("es-MX"),
    Usuario: r.usuario.nombre,
    Entidad: r.entidad,
    Accion: ACCIONES_AUDITORIA[r.accion] ?? r.accion,
    Motivo: r.motivo ?? "",
    DetalleAnterior: r.detalleAnterior ? JSON.stringify(r.detalleAnterior) : "",
    DetalleNuevo: r.detalleNuevo ? JSON.stringify(r.detalleNuevo) : "",
  }));

  const buffer = buildWorkbook([{ name: "Auditoria", rows }]);
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="auditoria.xlsx"',
    },
  });
}
```

- [ ] **Step 2: Verificar tipos y lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: sin errores.

- [ ] **Step 3: Verificación manual**

Con el servidor de dev corriendo y sesión de `admin@promerc.local` abierta en el navegador: entra a `/auditoria`, dale clic a "Exportar a Excel", confirma que descarga `auditoria.xlsx` y ábrelo para revisar que las columnas (`Fecha, Usuario, Entidad, Accion, Motivo, DetalleAnterior, DetalleNuevo`) tengan datos coherentes con lo que se ve en la tabla.

Luego, con sesión de `operador.ecatepec@promerc.local`, entra directo a `http://localhost:3000/api/exports/auditoria` por URL — debe redirigir a `/` sin descargar nada (mismo comportamiento que ya se validó hoy para `/api/exports/ventas`).

Expected: Excel correcto para ADMIN/SUPERVISOR, bloqueado por `requireRole` para OPERADOR.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/exports/auditoria/route.ts
git commit -m "Agregar exportación a Excel del visor de auditoría"
```

---

## Self-Review

**1. Spec coverage:**
- Acceso ADMIN/SUPERVISOR, sin scoping por ubicación → Task 2 (layout), confirmado.
- Filtros fecha/entidad/acción/usuario → Task 2 (page.tsx), confirmado.
- Columnas Fecha/Usuario/Entidad/Acción/Motivo + "Ver registro" (con exclusión de acciones de eliminación) + "Ver detalle" plegable → Task 2, confirmado.
- Paginación con `ListPagination` → Task 2, confirmado.
- Nav link → Task 3, confirmado.
- Export a Excel con mismos filtros y columnas (incluyendo JSON como texto) → Task 4, confirmado.
- Sin test dedicado, verificación manual → declarado en Global Constraints y en cada tarea.

**2. Placeholder scan:** sin "TBD"/"TODO"/frases vagas — cada step tiene código completo o comandos exactos con el resultado esperado.

**3. Type consistency:** `rutaRegistro(entidad: string, entidadId: number): string | null` (Task 1) se usa igual en Task 2 (`rutaRegistro(r.entidad, r.entidadId)`) y no se usa en Task 4 (el export no necesita el link). `ACCIONES_AUDITORIA` y `ACCIONES_SIN_REGISTRO` se importan con el mismo nombre y forma en Tasks 2 y 4. Los nombres de columnas del Excel en Task 4 (`Fecha, Usuario, Entidad, Accion, Motivo, DetalleAnterior, DetalleNuevo`) coinciden con lo descrito en el spec.
