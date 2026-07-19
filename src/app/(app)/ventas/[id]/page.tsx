import { notFound } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/dal";
import { prisma } from "@/lib/db";
import { CatalogForm } from "@/components/catalog-form";
import { Card, PageHeader } from "@/components/ui/card";
import { buttonClass } from "@/components/ui/button";
import { ReportarPesoForm } from "./reportar-peso-form";
import { aprobarExcepcionTolerancia } from "./actions";

const ESTADO_LABELS: Record<string, string> = {
  BORRADOR: "Falta reportar peso",
  PENDIENTE_APROBACION: "Tolerancia excedida — pendiente de aprobación",
  CERRADA: "Cerrada",
  CANCELADA: "Cancelada",
};

export default async function VentaDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const usuario = await getCurrentUser();
  const { id } = await params;
  const ventaId = Number(id);

  const venta = await prisma.venta.findUnique({
    where: { id: ventaId },
    include: {
      cliente: true,
      articulo: true,
      ubicacion: true,
      movimientos: { include: { lote: true } },
      evidencias: true,
      firmas: true,
    },
  });

  if (!venta) notFound();

  const puedeAprobar = usuario.role === "ADMIN" || usuario.role === "SUPERVISOR";
  const pendiente = venta.estado === "PENDIENTE_APROBACION";

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={`Venta a ${venta.cliente.nombre}`}
        action={
          <span
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              pendiente ? "bg-danger/10 text-danger" : "bg-primary/10 text-primary"
            }`}
          >
            {ESTADO_LABELS[venta.estado] ?? venta.estado}
          </span>
        }
      />

      <Card>
        <dl className="grid grid-cols-1 gap-x-6 gap-y-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <dt className="text-muted">Ubicación</dt>
          <dd>{venta.ubicacion.nombre}</dd>
          <dt className="text-muted">Artículo</dt>
          <dd>{venta.articulo.nombre}</dd>
          <dt className="text-muted">Peso vendido (del lote)</dt>
          <dd>{venta.pesoVendidoKg.toString()} kg</dd>
          <dt className="text-muted">Precio por kg</dt>
          <dd>{venta.precioUnitarioKg.toString()}</dd>
          <dt className="text-muted">Importe</dt>
          <dd className="font-semibold">{venta.importeTotal.toString()}</dd>
          {venta.pesoReportadoClienteKg && (
            <>
              <dt className="text-muted">Peso reportado por cliente</dt>
              <dd>{venta.pesoReportadoClienteKg.toString()} kg</dd>
              <dt className="text-muted">Penalización</dt>
              <dd>
                {venta.penalizacionKg.toString()} kg
                {venta.penalizacionMotivo ? ` — ${venta.penalizacionMotivo}` : ""}
              </dd>
              <dt className="text-muted">Tolerancia excedida</dt>
              <dd>{venta.toleranciaExcedida ? "Sí" : "No"}</dd>
            </>
          )}
        </dl>
      </Card>

      <div className="text-sm">
        <p className="font-medium">Lote(s) de origen</p>
        <ul className="list-disc pl-5">
          {venta.movimientos.map((m) => (
            <li key={m.id}>
              <Link href={`/lotes/${m.lote.id}`} className={buttonClass("link")}>
                {m.lote.folio}
              </Link>{" "}
              — {m.pesoAsignadoKg.toString()} kg
            </li>
          ))}
        </ul>
      </div>

      {venta.evidencias.length > 0 && (
        <div className="text-sm">
          <p className="font-medium">Evidencia</p>
          <ul className="list-disc pl-5">
            {venta.evidencias.map((e) => (
              <li key={e.id}>
                <a
                  href={`/api/evidencia/${e.id}`}
                  className={buttonClass("link")}
                  target="_blank"
                >
                  Comprobante de peso del cliente
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}

      {venta.firmas.length > 0 && (
        <div className="text-sm">
          <p className="font-medium">Aprobaciones</p>
          <ul className="list-disc pl-5">
            {venta.firmas.map((f) => (
              <li key={f.id}>
                Excepción de tolerancia aprobada por {f.nombreFirmante}: &quot;
                {f.justificacion}&quot;
              </li>
            ))}
          </ul>
        </div>
      )}

      {venta.estado === "BORRADOR" && (
        <ReportarPesoForm ventaId={venta.id} pesoVendidoKg={venta.pesoVendidoKg.toString()} />
      )}

      {pendiente && puedeAprobar && (
        <Card className="max-w-md border-danger/30">
          <p className="text-sm font-medium text-danger">
            La diferencia entre lo vendido y lo reportado excede el umbral de
            tolerancia. Se requiere aprobación de un supervisor para cerrar
            esta venta.
          </p>
          <div className="mt-3">
            <CatalogForm
              action={aprobarExcepcionTolerancia}
              submitLabel="Aprobar y cerrar venta"
              hiddenId={venta.id}
              fields={[
                { name: "justificacion", label: "Justificación", required: true },
              ]}
            />
          </div>
        </Card>
      )}

      {pendiente && !puedeAprobar && (
        <p className="text-sm text-danger">
          Esta venta excede el umbral de tolerancia y espera aprobación de un
          supervisor.
        </p>
      )}
    </div>
  );
}
