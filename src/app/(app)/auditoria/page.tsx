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
