import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
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
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Pesaje — folio {pesaje.folioTicket}</h1>
        <span className="text-sm">{ESTADO_LABELS[pesaje.estado] ?? pesaje.estado}</span>
      </div>

      <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm max-w-md">
        <dt className="text-zinc-500">Ubicación</dt>
        <dd>{pesaje.ubicacion.nombre}</dd>
        <dt className="text-zinc-500">Proveedor</dt>
        <dd>{pesaje.proveedor.nombre}</dd>
        <dt className="text-zinc-500">Artículo</dt>
        <dd>{pesaje.articulo.nombre}</dd>
        <dt className="text-zinc-500">Operador / placas</dt>
        <dd>
          {pesaje.operadorNombre} · {pesaje.placas}
        </dd>
        <dt className="text-zinc-500">Tara</dt>
        <dd>{pesaje.taraKg.toString()} kg</dd>
        {pesaje.estado !== "TARA_CAPTURADA" && (
          <>
            <dt className="text-zinc-500">Peso cargado</dt>
            <dd>{pesaje.grossKg?.toString() ?? "—"} kg</dd>
            <dt className="text-zinc-500">Neto</dt>
            <dd>{pesaje.netoKg?.toString() ?? "—"} kg</dd>
            <dt className="text-zinc-500">Pesador</dt>
            <dd>{pesaje.pesadorNombre ?? "—"}</dd>
            <dt className="text-zinc-500">Cliente destino</dt>
            <dd>{pesaje.clienteDestinoReferencia ?? "—"}</dd>
            <dt className="text-zinc-500">Observaciones</dt>
            <dd>{pesaje.observaciones ?? "—"}</dd>
          </>
        )}
        {pesaje.estado === "ANULADO" && (
          <>
            <dt className="text-zinc-500">Motivo de anulación</dt>
            <dd>{pesaje.motivoAnulacion}</dd>
          </>
        )}
      </dl>

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
                <a href={`/api/evidencia/${e.id}`} className="underline" target="_blank">
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
                <a href={`/api/firmas/${f.id}`} className="underline" target="_blank">
                  ver
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}

      {pesaje.estado === "COMPLETO" && (
        <div className="text-sm">
          {pesaje.compra ? (
            <Link href={`/compras/${pesaje.compra.id}`} className="underline">
              Ver compra registrada
            </Link>
          ) : (
            <Link href={`/compras/nuevo/${pesaje.id}`} className="underline">
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
            <label htmlFor="motivoAnulacion" className="text-sm font-medium">
              Anular este pesaje (opcional)
            </label>
            <input
              id="motivoAnulacion"
              name="motivoAnulacion"
              placeholder="Motivo"
              className="rounded-md border border-black/15 px-3 py-2 dark:border-white/20 dark:bg-black"
            />
            <button type="submit" className="self-start text-sm text-red-600 underline">
              Anular pesaje
            </button>
          </form>
        </>
      )}
    </div>
  );
}
