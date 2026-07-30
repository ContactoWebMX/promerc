import Link from "next/link";
import { requireRole } from "@/lib/auth/dal";
import { prisma } from "@/lib/db";
import { PageHeader, Card } from "@/components/ui/card";
import { inputClass, labelClass } from "@/components/ui/field";
import { buttonClass } from "@/components/ui/button";
import { TableWrapper, thClass, tdClass, trClass } from "@/components/ui/table";
import { EstadoBadge, type EstadoTone } from "@/components/ui/estado-badge";

const ESTADO_PESAJE: Record<string, { label: string; tone: EstadoTone }> = {
  TARA_CAPTURADA: { label: "Pendiente de salida", tone: "neutral" },
  CARGA_REGISTRADA: { label: "Cargado — pendiente de báscula", tone: "neutral" },
  COMPLETO: { label: "Completo", tone: "positive" },
  ANULADO: { label: "Anulado", tone: "danger" },
};

const ESTADO_LOTE: Record<string, { label: string; tone: EstadoTone }> = {
  ABIERTO: { label: "Abierto", tone: "neutral" },
  CERRADO: { label: "Cerrado", tone: "positive" },
};

export default async function BuscarPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const usuario = await requireRole(["ADMIN", "SUPERVISOR", "OPERADOR"]);
  const soloMiUbicacion = usuario.role !== "ADMIN" && usuario.role !== "SUPERVISOR";
  const params = await searchParams;
  const q = params.q?.trim() ?? "";

  const [pesajes, lotes] = q
    ? await Promise.all([
        prisma.pesaje.findMany({
          where: {
            ...(soloMiUbicacion ? { ubicacionId: usuario.ubicacionId ?? -1 } : {}),
            OR: [
              { folioTicket: { contains: q, mode: "insensitive" } },
              { idOperacionBascula: { contains: q, mode: "insensitive" } },
            ],
          },
          orderBy: { createdAt: "desc" },
          take: 20,
          include: { ubicacion: true, proveedor: true },
        }),
        prisma.lote.findMany({
          where: {
            ...(soloMiUbicacion ? { ubicacionId: usuario.ubicacionId ?? -1 } : {}),
            folio: { contains: q, mode: "insensitive" },
          },
          orderBy: { fecha: "desc" },
          take: 20,
          include: { ubicacion: true, articulo: true },
        }),
      ])
    : [[], []];

  const sinResultados = q.length > 0 && pesajes.length === 0 && lotes.length === 0;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Buscar" />

      <form method="get" className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <label htmlFor="q" className={labelClass}>
            Folio de ticket o de lote
          </label>
          <input
            id="q"
            name="q"
            type="search"
            defaultValue={q}
            placeholder="ej. TICKET-1234 o L-20260722-001"
            autoFocus
            className={`${inputClass} w-72`}
          />
        </div>
        <button type="submit" className={buttonClass("primary")}>
          Buscar
        </button>
      </form>

      {q.length === 0 && (
        <p className="text-sm text-muted">
          Escribe el folio del ticket de báscula o el folio de un lote.
        </p>
      )}

      {sinResultados && (
        <p className="text-sm text-muted">Sin resultados para &quot;{q}&quot;.</p>
      )}

      {pesajes.length > 0 && (
        <div className="flex flex-col gap-2">
          <h2 className="text-sm font-medium">Pesajes</h2>
          <TableWrapper>
            <thead>
              <tr>
                <th className={thClass}>Folio ticket</th>
                <th className={thClass}>Ubicación</th>
                <th className={thClass}>Proveedor</th>
                <th className={thClass}>Estado</th>
                <th className={thClass} />
              </tr>
            </thead>
            <tbody>
              {pesajes.map((p) => (
                <tr key={p.id} className={trClass}>
                  <td className={tdClass}>{p.folioTicket}</td>
                  <td className={tdClass}>{p.ubicacion.nombre}</td>
                  <td className={tdClass}>{p.proveedor.nombre}</td>
                  <td className={tdClass}>
                    <EstadoBadge
                      label={ESTADO_PESAJE[p.estado]?.label ?? p.estado}
                      tone={ESTADO_PESAJE[p.estado]?.tone ?? "neutral"}
                    />
                  </td>
                  <td className={tdClass}>
                    <Link href={`/pesajes/${p.id}`} className={buttonClass("link")}>
                      Ver
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </TableWrapper>
        </div>
      )}

      {lotes.length > 0 && (
        <div className="flex flex-col gap-2">
          <h2 className="text-sm font-medium">Lotes</h2>
          <TableWrapper>
            <thead>
              <tr>
                <th className={thClass}>Folio</th>
                <th className={thClass}>Ubicación</th>
                <th className={thClass}>Artículo</th>
                <th className={thClass}>Estado</th>
                <th className={thClass} />
              </tr>
            </thead>
            <tbody>
              {lotes.map((l) => (
                <tr key={l.id} className={trClass}>
                  <td className={tdClass}>{l.folio}</td>
                  <td className={tdClass}>{l.ubicacion.nombre}</td>
                  <td className={tdClass}>{l.articulo.nombre}</td>
                  <td className={tdClass}>
                    <EstadoBadge
                      label={ESTADO_LOTE[l.estado]?.label ?? l.estado}
                      tone={ESTADO_LOTE[l.estado]?.tone ?? "neutral"}
                    />
                  </td>
                  <td className={tdClass}>
                    <Link href={`/lotes/${l.id}`} className={buttonClass("link")}>
                      Ver
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </TableWrapper>
        </div>
      )}

      {sinResultados && (
        <Card className="max-w-md text-sm text-muted">
          <p>
            La compra y la venta de una operación no tienen folio propio — búscalas por el
            folio del ticket de báscula o el folio del lote y sigue el enlace desde ahí.
          </p>
        </Card>
      )}
    </div>
  );
}
