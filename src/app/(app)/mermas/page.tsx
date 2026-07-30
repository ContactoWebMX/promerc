import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/dal";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/ui/card";
import { buttonClass } from "@/components/ui/button";
import { inputClass, labelClass } from "@/components/ui/field";
import { TableWrapper, thClass, tdClass, trClass } from "@/components/ui/table";
import { EstadoBadge } from "@/components/ui/estado-badge";
import { SortableHeader } from "@/components/ui/sortable-header";
import { ListPagination } from "@/components/ui/list-pagination";
import { calcularDiferenciaPorcentual } from "@/lib/tolerancia";
import {
  resolverRangoFecha,
  resolverPorPagina,
  OPCIONES_POR_PAGINA,
} from "@/lib/rango-fecha";

const SORT_FIELDS = new Set([
  "fecha",
  "cliente",
  "articulo",
  "diferenciaKg",
  "diferenciaPct",
  "diferenciaMonto",
  "tipo",
]);

type FilaMerma = {
  id: number;
  fecha: Date;
  clienteNombre: string;
  articuloNombre: string;
  lotes: string;
  diferenciaKg: number;
  diferenciaPct: number;
  diferenciaMonto: number;
  tipo: "MERMA" | "SOBRANTE";
  toleranciaExcedida: boolean;
  motivoDiferencia: string | null;
};

// ponytail: diferenciaPct/diferenciaMonto no son columnas de la base (se
// derivan de diferenciaKg y precioUnitarioKg), así que ordenar por esas
// columnas no se puede resolver con orderBy de Prisma — se trae todo lo que
// cumple el filtro y se ordena/pagina en memoria, igual que en /lotes.
function ordenar(filas: FilaMerma[], sort: string, dir: "asc" | "desc"): FilaMerma[] {
  const factor = dir === "asc" ? 1 : -1;
  const copia = [...filas];
  copia.sort((a, b) => {
    switch (sort) {
      case "cliente":
        return factor * a.clienteNombre.localeCompare(b.clienteNombre);
      case "articulo":
        return factor * a.articuloNombre.localeCompare(b.articuloNombre);
      case "diferenciaKg":
        return factor * (Math.abs(a.diferenciaKg) - Math.abs(b.diferenciaKg));
      case "diferenciaPct":
        return factor * (a.diferenciaPct - b.diferenciaPct);
      case "diferenciaMonto":
        return factor * (Math.abs(a.diferenciaMonto) - Math.abs(b.diferenciaMonto));
      case "tipo":
        return factor * a.tipo.localeCompare(b.tipo);
      default:
        return factor * (a.fecha.getTime() - b.fecha.getTime());
    }
  });
  return copia;
}

export default async function MermasPage({
  searchParams,
}: {
  searchParams: Promise<{
    desde?: string;
    hasta?: string;
    tipo?: string;
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
  const tipo = params.tipo === "MERMA" || params.tipo === "SOBRANTE" ? params.tipo : undefined;

  const ventas = await prisma.venta.findMany({
    where: {
      ...(soloMiUbicacion ? { ubicacionId: usuario.ubicacionId ?? -1 } : {}),
      diferenciaKg: { not: 0 },
      createdAt: { gte: desde, lte: hasta },
    },
    include: {
      cliente: true,
      articulo: true,
      movimientos: { include: { lote: true } },
    },
  });

  const filas: FilaMerma[] = ventas.map((v) => {
    const diferenciaKg = Number(v.diferenciaKg);
    return {
      id: v.id,
      fecha: v.createdAt,
      clienteNombre: v.cliente.nombre,
      articuloNombre: v.articulo.nombre,
      lotes: [...new Set(v.movimientos.map((m) => m.lote.folio))].join(", "),
      diferenciaKg,
      diferenciaPct: v.pesoReportadoClienteKg
        ? calcularDiferenciaPorcentual(Number(v.pesoVendidoKg), Number(v.pesoReportadoClienteKg))
        : 0,
      diferenciaMonto: Number((diferenciaKg * Number(v.precioUnitarioKg)).toFixed(2)),
      tipo: diferenciaKg > 0 ? "MERMA" : "SOBRANTE",
      toleranciaExcedida: v.toleranciaExcedida,
      motivoDiferencia: v.motivoDiferencia,
    };
  });

  const filtradas = tipo ? filas.filter((f) => f.tipo === tipo) : filas;
  const total = filtradas.length;
  const totalPaginas = Math.max(1, Math.ceil(total / perPage));
  const ordenadas = ordenar(filtradas, sort, dir);
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
  if (tipo) currentParams.set("tipo", tipo);
  const sortableProps = { currentSort: sort, currentDir: dir, basePath: "/mermas", params: currentParams };

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Mermas y faltantes" />

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
          <label htmlFor="tipo" className={labelClass}>
            Tipo
          </label>
          <select id="tipo" name="tipo" defaultValue={tipo ?? ""} className={inputClass}>
            <option value="">Todos</option>
            <option value="MERMA">Merma</option>
            <option value="SOBRANTE">Sobrante</option>
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
          href={`/api/exports/mermas?${currentParams.toString()}`}
          className={buttonClass("link")}
        >
          Exportar a Excel
        </a>
      </form>

      <TableWrapper>
        <thead>
          <tr>
            <SortableHeader label="Fecha" field="fecha" {...sortableProps} />
            <SortableHeader label="Venta" field="cliente" {...sortableProps} />
            <th className={thClass}>Lote(s)</th>
            <SortableHeader label="Artículo" field="articulo" {...sortableProps} />
            <SortableHeader label="Diferencia (kg)" field="diferenciaKg" {...sortableProps} />
            <SortableHeader label="Diferencia (%)" field="diferenciaPct" {...sortableProps} />
            <SortableHeader label="Diferencia ($)" field="diferenciaMonto" {...sortableProps} />
            <SortableHeader label="Tipo" field="tipo" {...sortableProps} />
            <th className={thClass}>Tolerancia</th>
            <th className={thClass}>Motivo</th>
          </tr>
        </thead>
        <tbody>
          {enPagina.map((f) => (
            <tr key={f.id} className={trClass}>
              <td className={tdClass}>{f.fecha.toLocaleDateString("es-MX")}</td>
              <td className={tdClass}>
                <Link href={`/ventas/${f.id}`} className={buttonClass("link")}>
                  {f.clienteNombre}
                </Link>
              </td>
              <td className={tdClass}>{f.lotes || "—"}</td>
              <td className={tdClass}>{f.articuloNombre}</td>
              <td className={tdClass}>
                {f.diferenciaKg > 0 ? "+" : ""}
                {f.diferenciaKg.toFixed(2)}
              </td>
              <td className={tdClass}>{f.diferenciaPct.toFixed(1)}%</td>
              <td className={tdClass}>
                {f.diferenciaMonto > 0 ? "+" : ""}${f.diferenciaMonto.toFixed(2)}
              </td>
              <td className={tdClass}>
                <EstadoBadge
                  label={f.tipo === "MERMA" ? "Merma" : "Sobrante"}
                  tone={f.tipo === "MERMA" ? "danger" : "neutral"}
                />
              </td>
              <td className={tdClass}>
                {f.toleranciaExcedida ? (
                  <EstadoBadge label="Excedida" tone="danger" />
                ) : (
                  "Dentro"
                )}
              </td>
              <td className={tdClass}>{f.motivoDiferencia ?? "—"}</td>
            </tr>
          ))}
          {enPagina.length === 0 && (
            <tr>
              <td colSpan={10} className={`${tdClass} text-center text-muted`}>
                Sin diferencias reportadas con estos filtros.
              </td>
            </tr>
          )}
        </tbody>
      </TableWrapper>

      <ListPagination
        pagina={pagina_}
        totalPaginas={totalPaginas}
        total={total}
        etiqueta="registros"
        basePath="/mermas"
        params={currentParams}
      />
    </div>
  );
}
