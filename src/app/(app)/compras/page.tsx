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
  ABIERTA: { label: "Abierta", tone: "neutral" },
  CERRADA: { label: "Cerrada", tone: "positive" },
  CANCELADA: { label: "Cancelada", tone: "danger" },
};

const SORT_FIELDS = new Set([
  "folio",
  "proveedor",
  "articulo",
  "neto",
  "precio",
  "importe",
  "lote",
  "estado",
  "fecha",
]);

function ordenarPor(sort: string, dir: "asc" | "desc"): Prisma.CompraOrderByWithRelationInput {
  switch (sort) {
    case "folio":
      return { pesaje: { folioTicket: dir } };
    case "proveedor":
      return { proveedor: { nombre: dir } };
    case "articulo":
      return { pesaje: { articulo: { nombre: dir } } };
    case "neto":
      return { pesaje: { netoKg: dir } };
    case "precio":
      return { precioUnitarioKg: dir };
    case "importe":
      return { importeTotal: dir };
    case "lote":
      return { lote: { folio: dir } };
    case "estado":
      return { estado: dir };
    default:
      return { fechaOperacion: dir };
  }
}

export default async function ComprasPage({
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

  const where: Prisma.CompraWhereInput = {
    ...(soloMiUbicacion ? { ubicacionId: usuario.ubicacionId ?? -1 } : {}),
    fechaOperacion: { gte: desde, lte: hasta },
  };

  const [compras, total] = await Promise.all([
    prisma.compra.findMany({
      where,
      orderBy: ordenarPor(sort, dir),
      skip: (pagina - 1) * perPage,
      take: perPage,
      include: { pesaje: { include: { articulo: true } }, proveedor: true, lote: true },
    }),
    prisma.compra.count({ where }),
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
  const sortableProps = { currentSort: sort, currentDir: dir, basePath: "/compras", params: currentParams };

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Compras"
        action={
          <Link href="/pesajes" className={buttonClass("secondary", "sm")}>
            Ver pesajes completos para registrar una compra
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
          href={`/api/exports/compras?${currentParams.toString()}`}
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
            <SortableHeader label="Proveedor" field="proveedor" {...sortableProps} />
            <SortableHeader label="Artículo" field="articulo" {...sortableProps} />
            <SortableHeader label="Neto (kg)" field="neto" {...sortableProps} />
            <SortableHeader label="Precio/kg" field="precio" {...sortableProps} />
            <SortableHeader label="Importe" field="importe" {...sortableProps} />
            <SortableHeader label="Lote" field="lote" {...sortableProps} />
            <th className={thClass}>NetSuite</th>
            <th className={thClass} />
          </tr>
        </thead>
        <tbody>
          {compras.map((c) => (
            <tr key={c.id} className={trClass}>
              <td className={tdClass}>{c.fechaOperacion.toLocaleDateString("es-MX")}</td>
              <td className={tdClass}>{c.pesaje.folioTicket}</td>
              <td className={tdClass}>
                <EstadoBadge
                  label={ESTADO_CONFIG[c.estado]?.label ?? c.estado}
                  tone={ESTADO_CONFIG[c.estado]?.tone ?? "neutral"}
                />
              </td>
              <td className={tdClass}>{c.proveedor.nombre}</td>
              <td className={tdClass}>{c.pesaje.articulo?.nombre ?? "—"}</td>
              <td className={tdClass}>{c.pesaje.netoKg?.toString() ?? "—"}</td>
              <td className={tdClass}>${c.precioUnitarioKg.toString()}</td>
              <td className={tdClass}>${c.importeTotal.toString()}</td>
              <td className={tdClass}>
                {c.lote ? (
                  <Link href={`/lotes/${c.lote.id}`} className={buttonClass("link")}>
                    {c.lote.folio}
                  </Link>
                ) : (
                  "—"
                )}
              </td>
              <td className={tdClass}>
                {c.netsuiteOrderId ? (
                  <EstadoBadge
                    label={c.netsuiteOrderNumber ?? "Enviada"}
                    tone="positive"
                  />
                ) : (
                  "—"
                )}
              </td>
              <td className={tdClass}>
                <Link href={`/compras/${c.id}`} className={buttonClass("link")}>
                  Ver
                </Link>
              </td>
            </tr>
          ))}
          {compras.length === 0 && (
            <tr>
              <td colSpan={11} className={`${tdClass} text-center text-muted`}>
                Sin compras con estos filtros.
              </td>
            </tr>
          )}
        </tbody>
      </TableWrapper>

      <ListPagination
        pagina={pagina}
        totalPaginas={totalPaginas}
        total={total}
        etiqueta="compras"
        basePath="/compras"
        params={currentParams}
      />
    </div>
  );
}
