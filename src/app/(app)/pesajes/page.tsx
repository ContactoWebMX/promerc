import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/dal";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/ui/card";
import { buttonClass } from "@/components/ui/button";
import { inputClass, labelClass } from "@/components/ui/field";
import { TableWrapper, thClass, tdClass, trClass } from "@/components/ui/table";
import { EstadoBadge, type EstadoTone } from "@/components/ui/estado-badge";
import { SortableHeader } from "@/components/ui/sortable-header";
import { ListPagination } from "@/components/ui/list-pagination";
import {
  resolverRangoFecha,
  resolverPorPagina,
  OPCIONES_POR_PAGINA,
} from "@/lib/rango-fecha";
import type { Prisma } from "@/generated/prisma/client";

const ESTADO_CONFIG: Record<string, { label: string; tone: EstadoTone }> = {
  TARA_CAPTURADA: { label: "Pendiente de salida", tone: "neutral" },
  CARGA_REGISTRADA: { label: "Cargado — pendiente de báscula", tone: "neutral" },
  COMPLETO: { label: "Completo", tone: "positive" },
  ANULADO: { label: "Anulado", tone: "danger" },
};

const SORT_FIELDS = new Set([
  "folio",
  "ubicacion",
  "proveedor",
  "articulo",
  "tara",
  "neto",
  "estado",
  "fecha",
]);

function ordenarPor(sort: string, dir: "asc" | "desc"): Prisma.PesajeOrderByWithRelationInput {
  switch (sort) {
    case "folio":
      return { folioTicket: dir };
    case "ubicacion":
      return { ubicacion: { nombre: dir } };
    case "proveedor":
      return { proveedor: { nombre: dir } };
    case "articulo":
      return { articulo: { nombre: dir } };
    case "tara":
      return { taraKg: dir };
    case "neto":
      return { netoKg: dir };
    case "estado":
      return { estado: dir };
    default:
      return { createdAt: dir };
  }
}

export default async function PesajesPage({
  searchParams,
}: {
  searchParams: Promise<{
    desde?: string;
    hasta?: string;
    sort?: string;
    dir?: string;
    page?: string;
    perPage?: string;
  }>;
}) {
  const usuario = await getCurrentUser();
  const soloMiUbicacion = usuario.role !== "ADMIN" && usuario.role !== "SUPERVISOR";
  const params = await searchParams;

  const { desde, hasta, desdeStr, hastaStr } = resolverRangoFecha(params.desde, params.hasta);
  const sort = params.sort && SORT_FIELDS.has(params.sort) ? params.sort : "fecha";
  const dir: "asc" | "desc" = params.dir === "asc" ? "asc" : "desc";
  const perPage = resolverPorPagina(params.perPage);
  const pagina = Math.max(1, Number(params.page) || 1);

  const where: Prisma.PesajeWhereInput = {
    ...(soloMiUbicacion ? { ubicacionId: usuario.ubicacionId ?? -1 } : {}),
    createdAt: { gte: desde, lte: hasta },
  };

  const [pesajes, total] = await Promise.all([
    prisma.pesaje.findMany({
      where,
      orderBy: ordenarPor(sort, dir),
      skip: (pagina - 1) * perPage,
      take: perPage,
      include: { ubicacion: true, proveedor: true, articulo: true },
    }),
    prisma.pesaje.count({ where }),
  ]);

  const totalPaginas = Math.max(1, Math.ceil(total / perPage));

  // Refleja el estado resuelto (con defaults ya aplicados) para que el
  // encabezado ordenable, la paginación y el link de exportar preserven
  // exactamente lo que se está viendo en pantalla.
  const currentParams = new URLSearchParams({
    desde: desdeStr,
    hasta: hastaStr,
    sort,
    dir,
    perPage: perPage.toString(),
    page: pagina.toString(),
  });
  const sortableProps = { currentSort: sort, currentDir: dir, basePath: "/pesajes", params: currentParams };

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Pesajes"
        action={
          <Link href="/pesajes/nuevo" className={buttonClass("primary", "sm")}>
            Nuevo pesaje
          </Link>
        }
      />

      <form method="get" className="flex flex-wrap items-end gap-3">
        <input type="hidden" name="sort" value={sort} />
        <input type="hidden" name="dir" value={dir} />
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
          href={`/api/exports/pesajes?${currentParams.toString()}`}
          className={buttonClass("link")}
        >
          Exportar a Excel
        </a>
      </form>

      <TableWrapper>
        <thead>
          <tr>
            <SortableHeader label="Fecha" field="fecha" {...sortableProps} />
            <SortableHeader label="Folio ticket" field="folio" {...sortableProps} />
            <SortableHeader label="Estado" field="estado" {...sortableProps} />
            {!soloMiUbicacion && (
              <SortableHeader label="Ubicación" field="ubicacion" {...sortableProps} />
            )}
            <SortableHeader label="Proveedor" field="proveedor" {...sortableProps} />
            <SortableHeader label="Artículo" field="articulo" {...sortableProps} />
            <SortableHeader label="Tara (kg)" field="tara" {...sortableProps} />
            <SortableHeader label="Neto (kg)" field="neto" {...sortableProps} />
            <th className={thClass} />
          </tr>
        </thead>
        <tbody>
          {pesajes.map((p) => (
            <tr key={p.id} className={trClass}>
              <td className={tdClass}>{p.createdAt.toLocaleDateString("es-MX")}</td>
              <td className={tdClass}>{p.folioTicket}</td>
              <td className={tdClass}>
                <EstadoBadge
                  label={ESTADO_CONFIG[p.estado]?.label ?? p.estado}
                  tone={ESTADO_CONFIG[p.estado]?.tone ?? "neutral"}
                />
              </td>
              {!soloMiUbicacion && <td className={tdClass}>{p.ubicacion.nombre}</td>}
              <td className={tdClass}>{p.proveedor.nombre}</td>
              <td className={tdClass}>{p.articulo?.nombre ?? "—"}</td>
              <td className={tdClass}>{p.taraKg.toString()}</td>
              <td className={tdClass}>{p.netoKg?.toString() ?? "—"}</td>
              <td className={tdClass}>
                <Link href={`/pesajes/${p.id}`} className={buttonClass("link")}>
                  Ver
                </Link>
              </td>
            </tr>
          ))}
          {pesajes.length === 0 && (
            <tr>
              <td colSpan={soloMiUbicacion ? 8 : 9} className={`${tdClass} text-center text-muted`}>
                Sin pesajes con estos filtros.
              </td>
            </tr>
          )}
        </tbody>
      </TableWrapper>

      <ListPagination
        pagina={pagina}
        totalPaginas={totalPaginas}
        total={total}
        etiqueta="pesajes"
        basePath="/pesajes"
        params={currentParams}
      />
    </div>
  );
}
