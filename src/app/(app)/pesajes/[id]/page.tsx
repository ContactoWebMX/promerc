import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { getCurrentUser, canAccessUbicacion } from "@/lib/auth/dal";
import { Card, PageHeader } from "@/components/ui/card";
import { buttonClass } from "@/components/ui/button";
import { inputClass, labelClass } from "@/components/ui/field";
import { ActionDialog } from "@/components/ui/action-dialog";
import { EstadoBadge, type EstadoTone } from "@/components/ui/estado-badge";
import { CatalogForm } from "@/components/catalog-form";
import { Traza } from "@/components/ui/traza";
import { trazaDesdePesaje } from "@/lib/traza";
import { RegistrarSalidaForm } from "./registrar-salida-form";
import { CerrarPesajeForm } from "./cerrar-pesaje-form";
import { anularPesaje, corregirPesaje, eliminarPesaje } from "./actions";

const ESTADO_CONFIG: Record<string, { label: string; tone: EstadoTone }> = {
  TARA_CAPTURADA: { label: "Pendiente de salida", tone: "neutral" },
  CARGA_REGISTRADA: { label: "Cargado — pendiente de báscula", tone: "neutral" },
  COMPLETO: { label: "Completo", tone: "positive" },
  ANULADO: { label: "Anulado", tone: "danger" },
};

const TIPO_FIRMA_LABELS: Record<string, string> = {
  SALIDA_PROVEEDOR: "Salida (transportista)",
  VALIDACION_SUPERVISOR: "Validación (supervisor)",
  RECEPCION_CLIENTE: "Recepción (cliente)",
  EXCEPCION_TOLERANCIA: "Excepción de tolerancia",
};

const TIPO_EVIDENCIA_LABELS: Record<string, string> = {
  TICKET_TARA: "Foto de tara (camión vacío)",
  TICKET_BASCULA: "Foto de cierre (peso cargado)",
  COMPROBANTE_CLIENTE: "Comprobante del cliente",
  OTRO: "Otro",
};

function formatoFechaHora(fecha: Date | null | undefined) {
  if (!fecha) return "—";
  return new Intl.DateTimeFormat("es-MX", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(fecha);
}

export default async function PesajeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const pesajeId = Number(id);
  const usuario = await getCurrentUser();

  const [pesaje, unidadesEmpaque, articulos] = await Promise.all([
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
    prisma.articulo.findMany({ where: { activo: true }, orderBy: { nombre: "asc" } }),
  ]);

  if (!pesaje) notFound();
  if (!canAccessUbicacion(usuario, pesaje.ubicacionId)) notFound();

  const traza = await trazaDesdePesaje(pesaje.id);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={`Pesaje — folio ${pesaje.folioTicket}`}
        action={
          <EstadoBadge
            label={ESTADO_CONFIG[pesaje.estado]?.label ?? pesaje.estado}
            tone={ESTADO_CONFIG[pesaje.estado]?.tone ?? "neutral"}
          />
        }
      />

      {traza && <Traza traza={traza} actual={{ tipo: "pesaje", id: pesaje.id }} />}

      <Card>
        <dl className="grid grid-cols-1 gap-x-6 gap-y-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <dt className="text-muted">Ubicación</dt>
          <dd>{pesaje.ubicacion.nombre}</dd>
          <dt className="text-muted">Proveedor</dt>
          <dd>{pesaje.proveedor.nombre}</dd>
          <dt className="text-muted">ID de operación de báscula</dt>
          <dd>{pesaje.idOperacionBascula ?? "—"}</dd>
          <dt className="text-muted">Operador / placas</dt>
          <dd>
            {pesaje.operadorNombre} · {pesaje.placas}
          </dd>
          <dt className="text-muted">Tara</dt>
          <dd>{pesaje.taraKg.toString()} kg</dd>
          <dt className="text-muted">Fecha/hora de tara</dt>
          <dd>{formatoFechaHora(pesaje.taraCapturadaEn)}</dd>
          {pesaje.estado !== "TARA_CAPTURADA" && (
            <>
              <dt className="text-muted">Artículo</dt>
              <dd>{pesaje.articulo?.nombre ?? "—"}</dd>
              <dt className="text-muted">Destino</dt>
              <dd>{pesaje.clienteDestinoReferencia ?? "—"}</dd>
            </>
          )}
          {pesaje.estado === "COMPLETO" && (
            <>
              <dt className="text-muted">Peso cargado</dt>
              <dd>{pesaje.grossKg?.toString() ?? "—"} kg</dd>
              <dt className="text-muted">Neto</dt>
              <dd className="font-semibold">{pesaje.netoKg?.toString() ?? "—"} kg</dd>
              <dt className="text-muted">Fecha/hora de cierre</dt>
              <dd>{formatoFechaHora(pesaje.netoCapturadoEn)}</dd>
              <dt className="text-muted">Pesador</dt>
              <dd>{pesaje.pesadorNombre ?? "—"}</dd>
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
                  {TIPO_EVIDENCIA_LABELS[e.tipo] ?? e.tipo}
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
        <RegistrarSalidaForm
          pesajeId={pesaje.id}
          unidadesEmpaque={unidadesEmpaque}
          articulos={articulos}
        />
      )}

      {pesaje.estado === "CARGA_REGISTRADA" && (
        <CerrarPesajeForm pesajeId={pesaje.id} taraKg={pesaje.taraKg.toString()} />
      )}

      {(pesaje.estado === "TARA_CAPTURADA" ||
        pesaje.estado === "CARGA_REGISTRADA" ||
        (usuario.role === "ADMIN" && pesaje.estado !== "ANULADO") ||
        (usuario.role === "ADMIN" && !pesaje.compra)) && (
        <div className="flex flex-wrap gap-2">
          {(pesaje.estado === "TARA_CAPTURADA" || pesaje.estado === "CARGA_REGISTRADA") && (
            <ActionDialog
              label="Anular pesaje"
              tone="danger"
              title="Anular pesaje"
              description={`Folio ${pesaje.folioTicket} — tara ${pesaje.taraKg.toString()} kg. Esta acción no se puede deshacer.`}
            >
              <form action={anularPesaje} className="flex flex-col gap-2">
                <input type="hidden" name="id" value={pesaje.id} />
                <label htmlFor="motivoAnulacion" className={labelClass}>
                  Motivo
                </label>
                <input
                  id="motivoAnulacion"
                  name="motivoAnulacion"
                  placeholder="Motivo"
                  required
                  className={inputClass}
                />
                <button type="submit" className={buttonClass("danger")}>
                  Anular pesaje
                </button>
              </form>
            </ActionDialog>
          )}

          {usuario.role === "ADMIN" && pesaje.estado !== "ANULADO" && (
            <ActionDialog
              label="Corregir"
              title="Corregir pesaje (administrador)"
              description="Para errores de captura. Queda registrado en la bitácora de auditoría."
            >
              <CatalogForm
                action={corregirPesaje}
                submitLabel="Guardar corrección"
                hiddenId={pesaje.id}
                defaultValues={{
                  folioTicket: pesaje.folioTicket,
                  idOperacionBascula: pesaje.idOperacionBascula ?? "",
                  operadorNombre: pesaje.operadorNombre,
                  placas: pesaje.placas,
                  taraKg: pesaje.taraKg.toString(),
                  grossKg: pesaje.grossKg?.toString() ?? "",
                  articuloId: pesaje.articuloId?.toString() ?? "",
                  pesadorNombre: pesaje.pesadorNombre ?? "",
                  clienteDestinoReferencia: pesaje.clienteDestinoReferencia ?? "",
                  observaciones: pesaje.observaciones ?? "",
                }}
                fields={[
                  { name: "folioTicket", label: "Folio del ticket", required: true },
                  { name: "idOperacionBascula", label: "ID de operación de báscula" },
                  { name: "operadorNombre", label: "Operador", required: true },
                  { name: "placas", label: "Placas", required: true },
                  {
                    name: "taraKg",
                    label: "Tara (kg)",
                    type: "number",
                    required: true,
                    min: 0,
                    step: 0.01,
                  },
                  ...(pesaje.estado !== "TARA_CAPTURADA" && !pesaje.compra
                    ? [
                        {
                          name: "articuloId",
                          label: "Artículo",
                          type: "select" as const,
                          options: articulos.map((a) => ({
                            value: a.id.toString(),
                            label: a.nombre,
                          })),
                        },
                        { name: "clienteDestinoReferencia", label: "Destino" },
                      ]
                    : []),
                  ...(pesaje.estado === "COMPLETO"
                    ? [
                        {
                          name: "grossKg",
                          label: "Peso cargado (kg)",
                          type: "number" as const,
                          min: 0,
                          step: 0.01,
                        },
                        { name: "pesadorNombre", label: "Pesador" },
                        { name: "observaciones", label: "Observaciones" },
                      ]
                    : []),
                  { name: "motivo", label: "Motivo de la corrección", required: true },
                ]}
              />
            </ActionDialog>
          )}

          {usuario.role === "ADMIN" && !pesaje.compra && (
            <ActionDialog
              label="Eliminar pesaje"
              tone="danger"
              title="Eliminar pesaje"
              description={`Folio ${pesaje.folioTicket} — estado ${ESTADO_CONFIG[pesaje.estado]?.label ?? pesaje.estado}. No se puede deshacer.`}
            >
              <form action={eliminarPesaje} className="flex flex-col gap-2">
                <input type="hidden" name="id" value={pesaje.id} />
                <label htmlFor="motivoEliminar" className={labelClass}>
                  Motivo
                </label>
                <input
                  id="motivoEliminar"
                  name="motivo"
                  placeholder="Motivo"
                  required
                  className={inputClass}
                />
                <button type="submit" className={buttonClass("danger")}>
                  Eliminar pesaje
                </button>
              </form>
            </ActionDialog>
          )}
        </div>
      )}
    </div>
  );
}
