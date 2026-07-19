import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { Card, PageHeader } from "@/components/ui/card";
import { buttonClass } from "@/components/ui/button";
import { inputClass, labelClass } from "@/components/ui/field";
import { CerrarPesajeForm } from "./cerrar-pesaje-form";
import { anularPesaje } from "./actions";

const ESTADO_LABELS: Record<string, string> = {
  TARA_CAPTURADA: "Pendiente de cierre",
  COMPLETO: "Completo",
  ANULADO: "Anulado",
};

const TIPO_FIRMA_LABELS: Record<string, string> = {
  SALIDA_PROVEEDOR: "Salida (transportista)",
  VALIDACION_SUPERVISOR: "Validación (supervisor)",
  RECEPCION_CLIENTE: "Recepción (cliente)",
  EXCEPCION_TOLERANCIA: "Excepción de tolerancia",
};

export default async function PesajeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const pesajeId = Number(id);

  const [pesaje, unidadesEmpaque] = await Promise.all([
    prisma.pesaje.findUnique({
      where: { id: pesajeId },
      include: {
        ubicacion: true,
        articulo: true,
        proveedor: true,
        transportista: true,
        empaqueConteos: { include: { unidadEmpaque: true } },
        evidencias: true,
        firmas: true,
        compra: true,
      },
    }),
    prisma.unidadEmpaque.findMany({ where: { activo: true }, orderBy: { nombre: "asc" } }),
  ]);

  if (!pesaje) notFound();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={`Pesaje — folio ${pesaje.folioTicket}`}
        action={
          <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
            {ESTADO_LABELS[pesaje.estado] ?? pesaje.estado}
          </span>
        }
      />

      <Card>
        <dl className="grid grid-cols-1 gap-x-6 gap-y-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <dt className="text-muted">Ubicación</dt>
          <dd>{pesaje.ubicacion.nombre}</dd>
          <dt className="text-muted">Proveedor</dt>
          <dd>{pesaje.proveedor.nombre}</dd>
          <dt className="text-muted">Artículo</dt>
          <dd>{pesaje.articulo.nombre}</dd>
          <dt className="text-muted">Operador / placas</dt>
          <dd>
            {pesaje.operadorNombre} · {pesaje.placas}
          </dd>
          <dt className="text-muted">Tara</dt>
          <dd>{pesaje.taraKg.toString()} kg</dd>
          {pesaje.estado !== "TARA_CAPTURADA" && (
            <>
              <dt className="text-muted">Peso cargado</dt>
              <dd>{pesaje.grossKg?.toString() ?? "—"} kg</dd>
              <dt className="text-muted">Neto</dt>
              <dd className="font-semibold">{pesaje.netoKg?.toString() ?? "—"} kg</dd>
              <dt className="text-muted">Pesador</dt>
              <dd>{pesaje.pesadorNombre ?? "—"}</dd>
              <dt className="text-muted">Cliente destino</dt>
              <dd>{pesaje.clienteDestinoReferencia ?? "—"}</dd>
              <dt className="text-muted">Observaciones</dt>
              <dd>{pesaje.observaciones ?? "—"}</dd>
            </>
          )}
          {pesaje.estado === "ANULADO" && (
            <>
              <dt className="text-muted">Motivo de anulación</dt>
              <dd>{pesaje.motivoAnulacion}</dd>
            </>
          )}
        </dl>
      </Card>

      {pesaje.empaqueConteos.length > 0 && (
        <div className="text-sm">
          <p className="font-medium">Pacas</p>
          <ul className="list-disc pl-5">
            {pesaje.empaqueConteos.map((e) => (
              <li key={e.unidadEmpaqueId}>
                {e.unidadEmpaque.nombre}: {e.cantidad}
              </li>
            ))}
          </ul>
        </div>
      )}

      {pesaje.evidencias.length > 0 && (
        <div className="text-sm">
          <p className="font-medium">Evidencia</p>
          <ul className="list-disc pl-5">
            {pesaje.evidencias.map((e) => (
              <li key={e.id}>
                <a
                  href={`/api/evidencia/${e.id}`}
                  className={buttonClass("link")}
                  target="_blank"
                >
                  Foto del ticket
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}

      {pesaje.firmas.length > 0 && (
        <div className="text-sm">
          <p className="font-medium">Firmas</p>
          <ul className="list-disc pl-5">
            {pesaje.firmas.map((f) => (
              <li key={f.id}>
                {TIPO_FIRMA_LABELS[f.tipo] ?? f.tipo} — {f.nombreFirmante}{" "}
                <a
                  href={`/api/firmas/${f.id}`}
                  className={buttonClass("link")}
                  target="_blank"
                >
                  ver
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}

      {pesaje.estado === "COMPLETO" && (
        <div>
          {pesaje.compra ? (
            <Link href={`/compras/${pesaje.compra.id}`} className={buttonClass("secondary")}>
              Ver compra registrada
            </Link>
          ) : (
            <Link href={`/compras/nuevo/${pesaje.id}`} className={buttonClass("primary")}>
              Registrar compra
            </Link>
          )}
        </div>
      )}

      {pesaje.estado === "TARA_CAPTURADA" && (
        <>
          <CerrarPesajeForm
            pesajeId={pesaje.id}
            taraKg={pesaje.taraKg.toString()}
            unidadesEmpaque={unidadesEmpaque}
          />

          <form action={anularPesaje} className="flex max-w-sm flex-col gap-2">
            <input type="hidden" name="id" value={pesaje.id} />
            <label htmlFor="motivoAnulacion" className={labelClass}>
              Anular este pesaje (opcional)
            </label>
            <input
              id="motivoAnulacion"
              name="motivoAnulacion"
              placeholder="Motivo"
              className={inputClass}
            />
            <button type="submit" className={buttonClass("danger", "sm")}>
              Anular pesaje
            </button>
          </form>
        </>
      )}
    </div>
  );
}
