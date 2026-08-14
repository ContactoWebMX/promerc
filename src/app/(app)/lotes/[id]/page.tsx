import { notFound } from "next/navigation";
import Link from "next/link";
import { getCurrentUser, canAccessUbicacion } from "@/lib/auth/dal";
import { prisma } from "@/lib/db";
import { CatalogForm } from "@/components/catalog-form";
import { Card, PageHeader } from "@/components/ui/card";
import { buttonClass } from "@/components/ui/button";
import { EstadoBadge, type EstadoTone } from "@/components/ui/estado-badge";
import { Traza } from "@/components/ui/traza";
import { trazaDesdeLote } from "@/lib/traza";
import { AuditTimeline } from "@/components/ui/audit-timeline";
import { corregirFolioLote } from "./actions";

const ESTADO_CONFIG: Record<string, { label: string; tone: EstadoTone }> = {
  ABIERTO: { label: "Abierto", tone: "neutral" },
  CERRADO: { label: "Cerrado", tone: "positive" },
};

const ESTADO_COMPRA: Record<string, { label: string; tone: EstadoTone }> = {
  ABIERTA: { label: "Abierta", tone: "neutral" },
  CERRADA: { label: "Cerrada", tone: "positive" },
  CANCELADA: { label: "Cancelada", tone: "danger" },
};

export default async function LoteDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const usuario = await getCurrentUser();
  const { id } = await params;
  const loteId = Number(id);

  const [lote, auditoria] = await Promise.all([
    prisma.lote.findUnique({
      where: { id: loteId },
      include: {
        ubicacion: true,
        articulo: true,
        compras: { include: { pesaje: true, proveedor: true } },
        pesajes: { include: { compra: true } },
      },
    }),
    prisma.auditLog.findMany({
      where: { entidad: "Lote", entidadId: loteId },
      include: { usuario: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  if (!lote) notFound();
  if (!canAccessUbicacion(usuario, lote.ubicacionId)) notFound();

  const totalKg = lote.compras
    .filter((c) => c.estado !== "CANCELADA")
    .reduce((sum, c) => sum + Number(c.pesaje.netoKg ?? 0), 0);
  const pesajesSinCompra = lote.pesajes.filter((p) => !p.compra);
  const puedeCorregir = usuario.role === "ADMIN" || usuario.role === "SUPERVISOR";
  const traza = lote.pesajes.length === 1 ? await trazaDesdeLote(lote.id) : null;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={`Lote ${lote.folio}`}
        action={
          <EstadoBadge
            label={ESTADO_CONFIG[lote.estado]?.label ?? lote.estado}
            tone={ESTADO_CONFIG[lote.estado]?.tone ?? "neutral"}
          />
        }
      />
      <p className="-mt-4 text-sm text-muted">
        {lote.ubicacion.nombre} · {lote.articulo.nombre} ·{" "}
        {lote.fecha.toLocaleDateString("es-MX")}
      </p>

      {traza && <Traza traza={traza} actual={{ tipo: "lote", id: lote.id }} />}

      <Card className="text-sm">
        <p className="font-medium">
          Compras en este lote ({lote.compras.length}) — total{" "}
          <span className="font-semibold">{totalKg.toFixed(2)} kg</span>
        </p>
        <ul className="mt-2 list-disc pl-5">
          {lote.compras.map((c) => (
            <li key={c.id} className="flex items-center gap-2">
              <Link href={`/compras/${c.id}`} className={buttonClass("link")}>
                {c.pesaje.folioTicket}
              </Link>{" "}
              — {c.proveedor.nombre} — {c.pesaje.netoKg?.toString()} kg
              <EstadoBadge
                label={ESTADO_COMPRA[c.estado]?.label ?? c.estado}
                tone={ESTADO_COMPRA[c.estado]?.tone ?? "neutral"}
              />
            </li>
          ))}
          {lote.compras.length === 0 && <li>Sin compras asignadas todavía.</li>}
        </ul>
      </Card>

      {pesajesSinCompra.length > 0 && (
        <Card className="text-sm">
          <p className="font-medium">Pesado, falta registrar la compra</p>
          <ul className="mt-2 list-disc pl-5">
            {pesajesSinCompra.map((p) => (
              <li key={p.id}>
                {p.folioTicket} — {p.netoKg?.toString()} kg —{" "}
                <Link href={`/compras/nuevo/${p.id}`} className={buttonClass("link")}>
                  Registrar compra
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {puedeCorregir && (
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium">Corregir folio</p>
          <CatalogForm
            action={corregirFolioLote}
            submitLabel="Guardar corrección"
            hiddenId={lote.id}
            defaultValues={{ folio: lote.folio }}
            fields={[
              { name: "folio", label: "Folio", required: true, uppercase: true },
              { name: "motivo", label: "Motivo del cambio", required: true, uppercase: true },
            ]}
          />
        </div>
      )}

      {auditoria.length > 0 && (
        <div className="flex flex-col gap-3">
          <p className="text-sm font-medium">Historial de cambios</p>
          <AuditTimeline entradas={auditoria} />
        </div>
      )}
    </div>
  );
}
