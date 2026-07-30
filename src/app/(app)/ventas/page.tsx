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
  BORRADOR: { label: "Falta reportar peso", tone: "neutral" },
  PENDIENTE_APROBACION: { label: "Tolerancia excedida — pendiente", tone: "danger" },
  CERRADA: { label: "Cerrada", tone: "positive" },
  CANCELADA: { label: "Cancelada", tone: "danger" },
};

const SORT_FIELDS = new Set(["cliente", "estado", "articulo", "vendido", "importe", "fecha"]);

function ordenarPor(sort: string, dir: "asc" | "desc"): Prisma.VentaOrderByWithRelationInput {
  switch (sort) {
    case "cliente":
      return { cliente: { nombre: dir } };
    case "estado":
      return { estado: dir };
    case "articulo":
      return { articulo: { nombre: dir } };
    case "vendido":
      return { pesoVendidoKg: dir };
    case "importe":
      return { importeTotal: dir };
    default:
      return { createdAt: dir };
  }
}

export default async function VentasPage({
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

  const where: Prisma.VentaWhereInput = {
    ...(soloMiUbicacion ? { ubicacionId: usuario.ubicacionId ?? -1 } : {}),
    createdAt: { gte: desde, lte: hasta },
  };

  const [ventas, total] = await Promise.all([
    prisma.venta.findMany({
      where,
      orderBy: ordenarPor(sort, dir),
      skip: (pagina - 1) * perPage,
      take: perPage,
      include: { cliente: true, articulo: true },
    }),
    prisma.venta.count({ where }),
  ]);

  const totalPaginas = Math.max(1, Math.ceil(total / perPage));

  const currentParams = new URLSearchParams({
    desde: desdeStr,
    hasta: hastaStr,
    sort,
    dir,
    perPage: perPage.toString(),
    page: pagina.toString(),
  });
  const sortableProps = { currentSort: sort, currentDir: dir, basePath: "/ventas", params: currentParams };

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Ventas"
        action={
          <Link href="/ventas/nuevo" className={buttonClass("primary", "sm")}>
            Nueva venta
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
          href={`/api/exports/ventas?${currentParams.toString()}`}
          className={buttonClass("link")}
        >
          Exportar a Excel
        </a>
      </form>

      <TableWrapper>
        <thead>
          <tr>
            <SortableHeader label="Fecha" field="fecha" {...sortableProps} />
            <SortableHeader label="Cliente" field="cliente" {...sortableProps} />
            <SortableHeader label="Estado" field="estado" {...sortableProps} />
            <SortableHeader label="Artículo" field="articulo" {...sortableProps} />
            <SortableHeader label="Vendido (kg)" field="vendido" {...sortableProps} />
            <SortableHeader label="Importe" field="importe" {...sortableProps} />
            <th className={thClass} />
          </tr>
        </thead>
        <tbody>
          {ventas.map((v) => (
            <tr key={v.id} className={trClass}>
              <td className={tdClass}>{v.createdAt.toLocaleDateString("es-MX")}</td>
              <td className={tdClass}>{v.cliente.nombre}</td>
              <td className={tdClass}>
                <EstadoBadge
                  label={ESTADO_CONFIG[v.estado]?.label ?? v.estado}
                  tone={ESTADO_CONFIG[v.estado]?.tone ?? "neutral"}
                />
              </td>
              <td className={tdClass}>{v.articulo.nombre}</td>
              <td className={tdClass}>{v.pesoVendidoKg.toString()}</td>
              <td className={tdClass}>${v.importeTotal.toString()}</td>
              <td className={tdClass}>
                <Link href={`/ventas/${v.id}`} className={buttonClass("link")}>
                  Ver
                </Link>
              </td>
            </tr>
          ))}
          {ventas.length === 0 && (
            <tr>
              <td colSpan={7} className={`${tdClass} text-center text-muted`}>
                Sin ventas con estos filtros.
              </td>
            </tr>
          )}
        </tbody>
      </TableWrapper>

      <ListPagination
        pagina={pagina}
        totalPaginas={totalPaginas}
        total={total}
        etiqueta="ventas"
        basePath="/ventas"
        params={currentParams}
      />
    </div>
  );
}
