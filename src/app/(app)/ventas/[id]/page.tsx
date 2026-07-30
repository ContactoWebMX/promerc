import { notFound } from "next/navigation";
import Link from "next/link";
import { getCurrentUser, canAccessUbicacion } from "@/lib/auth/dal";
import { prisma } from "@/lib/db";
import { CatalogForm } from "@/components/catalog-form";
import { Card, PageHeader } from "@/components/ui/card";
import { buttonClass } from "@/components/ui/button";
import { inputClass, labelClass } from "@/components/ui/field";
import { ActionDialog } from "@/components/ui/action-dialog";
import { EstadoBadge, type EstadoTone } from "@/components/ui/estado-badge";
import { Traza } from "@/components/ui/traza";
import { trazaDesdeLote } from "@/lib/traza";
import { obtenerUmbralTolerancia } from "@/lib/tolerancia-config";
import { calcularDiferenciaPorcentual } from "@/lib/tolerancia";
import { ReportarPesoForm } from "./reportar-peso-form";
import { aprobarExcepcionTolerancia, corregirVenta, eliminarVenta } from "./actions";

const ESTADO_CONFIG: Record<string, { label: string; tone: EstadoTone }> = {
  BORRADOR: { label: "Falta reportar peso", tone: "neutral" },
  PENDIENTE_APROBACION: {
    label: "Tolerancia excedida — pendiente de aprobación",
    tone: "danger",
  },
  CERRADA: { label: "Cerrada", tone: "positive" },
  CANCELADA: { label: "Cancelada", tone: "danger" },
};

const ESTADO_LOTE: Record<string, { label: string; tone: EstadoTone }> = {
  ABIERTO: { label: "Abierto", tone: "neutral" },
  CERRADO: { label: "Cerrado", tone: "positive" },
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
  if (!canAccessUbicacion(usuario, venta.ubicacionId)) notFound();

  const puedeAprobar = usuario.role === "ADMIN" || usuario.role === "SUPERVISOR";
  const pendiente = venta.estado === "PENDIENTE_APROBACION";
  const traza =
    venta.movimientos.length === 1
      ? await trazaDesdeLote(venta.movimientos[0].loteId)
      : null;
  const umbralPct = await obtenerUmbralTolerancia(venta.articuloId);
  const diferenciaPct = venta.pesoReportadoClienteKg
    ? calcularDiferenciaPorcentual(
        Number(venta.pesoVendidoKg),
        Number(venta.pesoReportadoClienteKg),
      )
    : 0;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={`Venta a ${venta.cliente.nombre}`}
        action={
          <EstadoBadge
            label={ESTADO_CONFIG[venta.estado]?.label ?? venta.estado}
            tone={ESTADO_CONFIG[venta.estado]?.tone ?? "neutral"}
          />
        }
      />

      {traza && <Traza traza={traza} actual={{ tipo: "venta", id: venta.id }} />}

      <Card>
        <dl className="grid grid-cols-1 gap-x-6 gap-y-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <dt className="text-muted">Ubicación</dt>
          <dd>{venta.ubicacion.nombre}</dd>
          <dt className="text-muted">Artículo</dt>
          <dd>{venta.articulo.nombre}</dd>
          <dt className="text-muted">Peso vendido (del lote)</dt>
          <dd>{venta.pesoVendidoKg.toString()} kg</dd>
          <dt className="text-muted">Precio por kg</dt>
          <dd>${venta.precioUnitarioKg.toString()}</dd>
          <dt className="text-muted">Importe</dt>
          <dd className="font-semibold">${venta.importeTotal.toString()}</dd>
          {venta.pesoReportadoClienteKg && (
            <>
              <dt className="text-muted">Peso reportado por cliente</dt>
              <dd>{venta.pesoReportadoClienteKg.toString()} kg</dd>
              <dt className="text-muted">Diferencia</dt>
              <dd>
                {Number(venta.diferenciaKg) === 0
                  ? "Sin diferencia"
                  : `${Number(venta.diferenciaKg) > 0 ? "Merma" : "Sobrante"} de ${Math.abs(Number(venta.diferenciaKg))} kg (${diferenciaPct.toFixed(1)}%)`}
                {venta.motivoDiferencia ? ` — ${venta.motivoDiferencia}` : ""}
              </dd>
              <dt className="text-muted">Tolerancia excedida</dt>
              <dd>{venta.toleranciaExcedida ? "Sí" : "No"}</dd>
            </>
          )}
        </dl>
      </Card>

      {!traza && (
        <div className="text-sm">
          <p className="font-medium">Lote(s) de origen</p>
          <ul className="list-disc pl-5">
            {venta.movimientos.map((m) => (
              <li key={m.id} className="flex items-center gap-2">
                <Link href={`/lotes/${m.lote.id}`} className={buttonClass("link")}>
                  {m.lote.folio}
                </Link>{" "}
                — {m.pesoAsignadoKg.toString()} kg
                <EstadoBadge
                  label={ESTADO_LOTE[m.lote.estado]?.label ?? m.lote.estado}
                  tone={ESTADO_LOTE[m.lote.estado]?.tone ?? "neutral"}
                />
              </li>
            ))}
            {venta.movimientos.length === 0 && <li>Sin lote asignado todavía.</li>}
          </ul>
        </div>
      )}

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
        <ReportarPesoForm
          ventaId={venta.id}
          pesoVendidoKg={venta.pesoVendidoKg.toString()}
          umbralPct={umbralPct}
        />
      )}

      {pendiente && puedeAprobar && (
        <Card className="max-w-md border-danger/30">
          <p className="text-sm font-medium text-danger">
            La diferencia de {Math.abs(Number(venta.diferenciaKg))} kg (
            {diferenciaPct.toFixed(1)}%) entre lo vendido y lo reportado excede
            el umbral de tolerancia ({umbralPct}%). Se requiere aprobación de
            un supervisor para cerrar esta venta.
          </p>
          <div className="mt-3">
            <CatalogForm
              action={aprobarExcepcionTolerancia}
              submitLabel="Aprobar y cerrar venta"
              hiddenId={venta.id}
              confirmMessage="¿Aprobar la excepción de tolerancia y cerrar esta venta? Queda registrado en la bitácora de auditoría."
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

      {usuario.role === "ADMIN" && venta.estado !== "CANCELADA" && (
        <div className="flex flex-wrap gap-2">
          <ActionDialog
            label="Corregir"
            title="Corregir venta (administrador)"
            description="Para errores de captura. Si al corregir vuelve a exceder la tolerancia, la venta regresa a pendiente de aprobación. Queda registrado en la bitácora de auditoría."
          >
            <CatalogForm
              action={corregirVenta}
              submitLabel="Guardar corrección"
              hiddenId={venta.id}
              defaultValues={{
                precioUnitarioKg: venta.precioUnitarioKg.toString(),
                pesoReportadoClienteKg: venta.pesoReportadoClienteKg?.toString() ?? "",
                motivoDiferencia: venta.motivoDiferencia ?? "",
              }}
              fields={[
                {
                  name: "precioUnitarioKg",
                  label: "Precio por kg ($)",
                  type: "number",
                  required: true,
                  min: 0,
                  step: 0.01,
                },
                ...(venta.estado !== "BORRADOR"
                  ? [
                      {
                        name: "pesoReportadoClienteKg",
                        label: "Peso reportado por cliente (kg)",
                        type: "number" as const,
                        min: 0,
                        step: 0.01,
                      },
                      {
                        name: "motivoDiferencia",
                        label: "Motivo de la diferencia",
                      },
                    ]
                  : []),
                { name: "motivo", label: "Motivo de la corrección", required: true },
              ]}
            />
          </ActionDialog>

          {venta.estado === "BORRADOR" && (
            <ActionDialog
              label="Eliminar venta"
              tone="danger"
              title="Eliminar venta"
              description={`Cliente ${venta.cliente.nombre} — importe $${venta.importeTotal.toString()}. No se puede deshacer.`}
            >
              <form action={eliminarVenta} className="flex flex-col gap-2">
                <input type="hidden" name="id" value={venta.id} />
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
                  Eliminar venta
                </button>
              </form>
            </ActionDialog>
          )}
        </div>
      )}
    </div>
  );
}
