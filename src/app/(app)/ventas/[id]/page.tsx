import { notFound } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/dal";
import { prisma } from "@/lib/db";
import { CatalogForm } from "@/components/catalog-form";
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

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">
          Venta a {venta.cliente.nombre}
        </h1>
        <span className="text-sm">{ESTADO_LABELS[venta.estado] ?? venta.estado}</span>
      </div>

      <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm max-w-md">
        <dt className="text-zinc-500">Ubicación</dt>
        <dd>{venta.ubicacion.nombre}</dd>
        <dt className="text-zinc-500">Artículo</dt>
        <dd>{venta.articulo.nombre}</dd>
        <dt className="text-zinc-500">Peso vendido (del lote)</dt>
        <dd>{venta.pesoVendidoKg.toString()} kg</dd>
        <dt className="text-zinc-500">Precio por kg</dt>
        <dd>{venta.precioUnitarioKg.toString()}</dd>
        <dt className="text-zinc-500">Importe</dt>
        <dd>{venta.importeTotal.toString()}</dd>
        {venta.pesoReportadoClienteKg && (
          <>
            <dt className="text-zinc-500">Peso reportado por cliente</dt>
            <dd>{venta.pesoReportadoClienteKg.toString()} kg</dd>
            <dt className="text-zinc-500">Penalización</dt>
            <dd>
              {venta.penalizacionKg.toString()} kg
              {venta.penalizacionMotivo ? ` — ${venta.penalizacionMotivo}` : ""}
            </dd>
            <dt className="text-zinc-500">Tolerancia excedida</dt>
            <dd>{venta.toleranciaExcedida ? "Sí" : "No"}</dd>
          </>
        )}
      </dl>

      <div className="text-sm">
        <p className="font-medium">Lote(s) de origen</p>
        <ul className="list-disc pl-5">
          {venta.movimientos.map((m) => (
            <li key={m.id}>
              <Link href={`/lotes/${m.lote.id}`} className="underline">
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
                <a href={`/api/evidencia/${e.id}`} className="underline" target="_blank">
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

      {venta.estado === "PENDIENTE_APROBACION" && puedeAprobar && (
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium text-red-600">
            La diferencia entre lo vendido y lo reportado excede el umbral de
            tolerancia. Se requiere aprobación de un supervisor para cerrar
            esta venta.
          </p>
          <CatalogForm
            action={aprobarExcepcionTolerancia}
            submitLabel="Aprobar y cerrar venta"
            hiddenId={venta.id}
            fields={[
              { name: "justificacion", label: "Justificación", required: true },
            ]}
          />
        </div>
      )}

      {venta.estado === "PENDIENTE_APROBACION" && !puedeAprobar && (
        <p className="text-sm text-red-600">
          Esta venta excede el umbral de tolerancia y espera aprobación de un
          supervisor.
        </p>
      )}
    </div>
  );
}
