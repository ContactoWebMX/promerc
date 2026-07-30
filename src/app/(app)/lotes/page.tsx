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

const ESTADO_CONFIG: Record<string, { label: string; tone: EstadoTone }> = {
  ABIERTO: { label: "Abierto", tone: "neutral" },
  CERRADO: { label: "Cerrado", tone: "positive" },
};

const SORT_FIELDS = new Set([
  "folio",
  "ubicacion",
  "articulo",
  "fecha",
  "comprado",
  "vendido",
  "disponible",
  "estado",
]);

type FilaLote = {
  id: number;
  folio: string;
  folioCorregido: boolean;
  fecha: Date;
  estado: string;
  ubicacionNombre: string;
  articuloNombre: string;
  comprado: number;
  vendido: number;
  disponible: number;
};

// ponytail: comprado/vendido/disponible no son columnas de la base (se
// calculan sumando compras y movimientos), así que ordenar por esas
// columnas no se puede resolver con orderBy de Prisma — se trae todo lo
// que cumple el filtro y se ordena/pagina en memoria. Suficiente para el
// volumen de una báscula (cientos-miles de lotes); si crece mucho, mover el
// cálculo a columnas materializadas.
function ordenar(filas: FilaLote[], sort: string, dir: "asc" | "desc"): FilaLote[] {
  const factor = dir === "asc" ? 1 : -1;
  const copia = [...filas];
  copia.sort((a, b) => {
    switch (sort) {
      case "folio":
        return factor * a.folio.localeCompare(b.folio);
      case "ubicacion":
        return factor * a.ubicacionNombre.localeCompare(b.ubicacionNombre);
      case "articulo":
        return factor * a.articuloNombre.localeCompare(b.articuloNombre);
      case "comprado":
        return factor * (a.comprado - b.comprado);
      case "vendido":
        return factor * (a.vendido - b.vendido);
      case "disponible":
        return factor * (a.disponible - b.disponible);
      case "estado":
        return factor * a.estado.localeCompare(b.estado);
      default:
        return factor * (a.fecha.getTime() - b.fecha.getTime());
    }
  });
  return copia;
}

export default async function LotesPage({
  searchParams,
}: {
  searchParams: Promise<{
    desde?: string;
    hasta?: string;
    ubicacionId?: string;
    articuloId?: string;
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

  const ubicacionId = soloMiUbicacion
    ? (usuario.ubicacionId ?? -1)
    : params.ubicacionId
      ? Number(params.ubicacionId)
      : undefined;
  const articuloId = params.articuloId ? Number(params.articuloId) : undefined;

  const where = {
    ...(ubicacionId ? { ubicacionId } : {}),
    ...(articuloId ? { articuloId } : {}),
    fecha: { gte: desde, lte: hasta },
  };

  const [lotesRaw, ubicaciones, articulos] = await Promise.all([
    prisma.lote.findMany({
      where,
      include: {
        ubicacion: true,
        articulo: true,
        compras: { include: { pesaje: true } },
        movimientos: { select: { pesoAsignadoKg: true } },
      },
    }),
    soloMiUbicacion
      ? Promise.resolve([])
      : prisma.ubicacion.findMany({ where: { activo: true }, orderBy: { nombre: "asc" } }),
    prisma.articulo.findMany({ where: { activo: true }, orderBy: { nombre: "asc" } }),
  ]);

  const filas: FilaLote[] = lotesRaw.map((l) => {
    const comprado = l.compras
      .filter((c) => c.estado !== "CANCELADA")
      .reduce((sum, c) => sum + Number(c.pesaje.netoKg ?? 0), 0);
    const vendido = l.movimientos.reduce((sum, m) => sum + Number(m.pesoAsignadoKg), 0);
    return {
      id: l.id,
      folio: l.folio,
      folioCorregido: l.folioCorregido,
      fecha: l.fecha,
      estado: l.estado,
      ubicacionNombre: l.ubicacion.nombre,
      articuloNombre: l.articulo.nombre,
      comprado,
      vendido,
      disponible: comprado - vendido,
    };
  });

  const total = filas.length;
  const totalPaginas = Math.max(1, Math.ceil(total / perPage));
  const ordenadas = ordenar(filas, sort, dir);
  const pagina_ = Math.min(pagina, totalPaginas);
  const enPagina = ordenadas.slice((pagina_ - 1) * perPage, pagina_ * perPage);

  const currentParams = new URLSearchParams({
    desde: desdeStr,
    hasta: hastaStr,
    sort,
    dir,
    perPage: perPage.toString(),
    page: pagina_.toString(),
  });
  if (params.ubicacionId) currentParams.set("ubicacionId", params.ubicacionId);
  if (params.articuloId) currentParams.set("articuloId", params.articuloId);
  const sortableProps = { currentSort: sort, currentDir: dir, basePath: "/lotes", params: currentParams };

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Lotes" />

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
        {!soloMiUbicacion && (
          <div className="flex flex-col gap-1">
            <label htmlFor="ubicacionId" className={labelClass}>
              Ubicación
            </label>
            <select
              id="ubicacionId"
              name="ubicacionId"
              defaultValue={params.ubicacionId ?? ""}
              className={inputClass}
            >
              <option value="">Todas</option>
              {ubicaciones.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.nombre}
                </option>
              ))}
            </select>
          </div>
        )}
        <div className="flex flex-col gap-1">
          <label htmlFor="articuloId" className={labelClass}>
            Artículo
          </label>
          <select
            id="articuloId"
            name="articuloId"
            defaultValue={params.articuloId ?? ""}
            className={inputClass}
          >
            <option value="">Todos</option>
            {articulos.map((a) => (
              <option key={a.id} value={a.id}>
                {a.nombre}
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
        <a href={`/api/exports/lotes?${currentParams.toString()}`} className={buttonClass("link")}>
          Exportar a Excel
        </a>
      </form>

      <TableWrapper>
        <thead>
          <tr>
            <SortableHeader label="Fecha" field="fecha" {...sortableProps} />
            <SortableHeader label="Folio" field="folio" {...sortableProps} />
            <SortableHeader label="Estado" field="estado" {...sortableProps} />
            {!soloMiUbicacion && (
              <SortableHeader label="Ubicación" field="ubicacion" {...sortableProps} />
            )}
            <SortableHeader label="Artículo" field="articulo" {...sortableProps} />
            <SortableHeader label="Comprado (kg)" field="comprado" {...sortableProps} />
            <SortableHeader label="Vendido (kg)" field="vendido" {...sortableProps} />
            <SortableHeader label="Disponible (kg)" field="disponible" {...sortableProps} />
            <th className={thClass} />
          </tr>
        </thead>
        <tbody>
          {enPagina.map((l) => (
            <tr key={l.id} className={trClass}>
              <td className={tdClass}>{l.fecha.toLocaleDateString("es-MX")}</td>
              <td className={tdClass}>
                {l.folio}
                {l.folioCorregido && (
                  <span className="ml-1 text-xs text-muted">(corregido)</span>
                )}
              </td>
              <td className={tdClass}>
                <EstadoBadge
                  label={ESTADO_CONFIG[l.estado]?.label ?? l.estado}
                  tone={ESTADO_CONFIG[l.estado]?.tone ?? "neutral"}
                />
              </td>
              {!soloMiUbicacion && <td className={tdClass}>{l.ubicacionNombre}</td>}
              <td className={tdClass}>{l.articuloNombre}</td>
              <td className={tdClass}>{l.comprado.toFixed(2)}</td>
              <td className={tdClass}>{l.vendido.toFixed(2)}</td>
              <td className={tdClass}>{l.disponible.toFixed(2)}</td>
              <td className={tdClass}>
                <Link href={`/lotes/${l.id}`} className={buttonClass("link")}>
                  Ver
                </Link>
              </td>
            </tr>
          ))}
          {enPagina.length === 0 && (
            <tr>
              <td colSpan={soloMiUbicacion ? 8 : 9} className={`${tdClass} text-center text-muted`}>
                Sin lotes con estos filtros.
              </td>
            </tr>
          )}
        </tbody>
      </TableWrapper>

      <ListPagination
        pagina={pagina_}
        totalPaginas={totalPaginas}
        total={total}
        etiqueta="lotes"
        basePath="/lotes"
        params={currentParams}
      />
    </div>
  );
}
