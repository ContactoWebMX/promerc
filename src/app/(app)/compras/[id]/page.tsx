import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { getCurrentUser, canAccessUbicacion } from "@/lib/auth/dal";
import { Card, PageHeader } from "@/components/ui/card";
import { buttonClass } from "@/components/ui/button";
import { ActionDialog } from "@/components/ui/action-dialog";
import { EstadoBadge, type EstadoTone } from "@/components/ui/estado-badge";
import { CatalogForm } from "@/components/catalog-form";
import { Traza } from "@/components/ui/traza";
import { trazaDesdePesaje } from "@/lib/traza";
import { corregirCompra, eliminarCompra, anularCompra, enviarCompraANetSuite } from "./actions";

const ESTADO_CONFIG: Record<string, { label: string; tone: EstadoTone }> = {
  ABIERTA: { label: "Abierta", tone: "neutral" },
  CERRADA: { label: "Cerrada", tone: "positive" },
  CANCELADA: { label: "Cancelada", tone: "danger" },
};

export default async function CompraDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const usuario = await getCurrentUser();
  const compra = await prisma.compra.findUnique({
    where: { id: Number(id) },
    include: {
      pesaje: { include: { articulo: true } },
      proveedor: true,
      ubicacion: true,
      lote: { include: { movimientos: true } },
    },
  });

  if (!compra) notFound();
  if (!canAccessUbicacion(usuario, compra.ubicacionId)) notFound();

  const asignado =
    compra.lote?.movimientos.reduce((s, m) => s + Number(m.pesoAsignadoKg), 0) ?? 0;
  // Eliminar ya es seguro aunque se haya enviado a NetSuite (eliminarCompra
  // borra allá primero y aborta si NetSuite lo rechaza). Anular no tiene un
  // equivalente tan directo en NetSuite (cerrar una orden depende de cómo
  // esté configurado el flujo de aprobación de cada cuenta) — se bloquea y
  // se pide cancelarla allá manualmente primero.
  const puedeEliminar =
    usuario.role === "ADMIN" && asignado === 0 && compra.estado !== "CANCELADA";
  const puedeEnviarANetSuite =
    (usuario.role === "ADMIN" || usuario.role === "SUPERVISOR") &&
    compra.estado !== "CANCELADA" &&
    !compra.netsuiteOrderId;
  const faltaMapeoNetSuite =
    !compra.proveedor.netsuiteVendorId || !compra.pesaje.articulo?.netsuiteItemId;
  const traza = await trazaDesdePesaje(compra.pesajeId);

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={`Compra — ticket ${compra.pesaje.folioTicket}`} />

      {traza && <Traza traza={traza} actual={{ tipo: "compra", id: compra.id }} />}
      <Card>
        <dl className="grid grid-cols-1 gap-x-6 gap-y-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <dt className="text-muted">Fecha de operación</dt>
          <dd>{compra.fechaOperacion.toLocaleDateString("es-MX")}</dd>
          <dt className="text-muted">Proveedor</dt>
          <dd>{compra.proveedor.nombre}</dd>
          <dt className="text-muted">Ubicación</dt>
          <dd>{compra.ubicacion.nombre}</dd>
          <dt className="text-muted">Artículo</dt>
          <dd>{compra.pesaje.articulo?.nombre ?? "—"}</dd>
          <dt className="text-muted">Neto comprado</dt>
          <dd>{compra.pesaje.netoKg?.toString()} kg</dd>
          <dt className="text-muted">Precio por kg</dt>
          <dd>${compra.precioUnitarioKg.toString()}</dd>
          <dt className="text-muted">Importe total</dt>
          <dd className="font-semibold">${compra.importeTotal.toString()}</dd>
          <dt className="text-muted">Estado</dt>
          <dd>
            <EstadoBadge
              label={ESTADO_CONFIG[compra.estado]?.label ?? compra.estado}
              tone={ESTADO_CONFIG[compra.estado]?.tone ?? "neutral"}
            />
          </dd>
          <dt className="text-muted">Lote</dt>
          <dd>
            {compra.lote ? (
              <Link href={`/lotes/${compra.lote.id}`} className={buttonClass("link")}>
                {compra.lote.folio}
              </Link>
            ) : (
              "—"
            )}
          </dd>
          <dt className="text-muted">NetSuite</dt>
          <dd>
            {compra.netsuiteOrderId ? (
              <EstadoBadge
                label={
                  compra.netsuiteOrderNumber
                    ? `Enviada — ${compra.netsuiteOrderNumber}`
                    : "Enviada (folio pendiente de confirmar)"
                }
                tone="positive"
              />
            ) : (
              "—"
            )}
          </dd>
        </dl>
      </Card>

      {puedeEnviarANetSuite && (
        <Card>
          {faltaMapeoNetSuite ? (
            <p className="text-sm text-muted">
              Falta configurar el ID de NetSuite del proveedor o del artículo antes de poder
              enviar esta compra como Orden de Compra.
            </p>
          ) : (
            <CatalogForm
              action={enviarCompraANetSuite}
              submitLabel="Enviar a NetSuite"
              hiddenId={compra.id}
              confirmMessage={`¿Enviar esta compra como Orden de Compra a NetSuite? Proveedor ${compra.proveedor.nombre}, importe $${compra.importeTotal.toString()}.`}
              fields={[]}
            />
          )}
        </Card>
      )}

      {usuario.role === "ADMIN" && (
        <div className="flex flex-wrap items-center gap-2">
          {compra.estado !== "CANCELADA" && (
            <ActionDialog
              label="Corregir"
              title="Corregir compra (administrador)"
              description="Para errores de captura. Queda registrado en la bitácora de auditoría."
            >
              <CatalogForm
                action={corregirCompra}
                submitLabel="Guardar corrección"
                hiddenId={compra.id}
                defaultValues={{
                  precioUnitarioKg: compra.precioUnitarioKg.toString(),
                  fechaOperacion: compra.fechaOperacion.toISOString().slice(0, 10),
                }}
                fields={[
                  {
                    name: "fechaOperacion",
                    label: "Fecha de operación",
                    type: "date",
                    required: true,
                    helpText: "Fecha real de la compra (ticket) — se usa también al enviar a NetSuite.",
                  },
                  {
                    name: "precioUnitarioKg",
                    label: "Precio por kg ($)",
                    type: "number",
                    required: true,
                    min: 0,
                    step: 0.01,
                  },
                  { name: "motivo", label: "Motivo de la corrección", required: true, uppercase: true },
                ]}
              />
            </ActionDialog>
          )}

          {puedeEliminar ? (
            <>
              {compra.netsuiteOrderId ? (
                <p className="text-sm text-muted">
                  Ya se envió a NetSuite — cancélala allá primero si necesitas anularla aquí.
                  Eliminar sigue disponible y también la borra en NetSuite.
                </p>
              ) : (
                <ActionDialog
                  label="Anular compra"
                  tone="danger"
                  title="Anular compra"
                  description={`Ticket ${compra.pesaje.folioTicket} — importe $${compra.importeTotal.toString()}. Se conserva el registro, con el motivo, en la bitácora de auditoría.`}
                >
                  <CatalogForm
                    action={anularCompra}
                    submitLabel="Anular compra"
                    hiddenId={compra.id}
                    fields={[{ name: "motivo", label: "Motivo de la anulación", required: true, uppercase: true }]}
                  />
                </ActionDialog>
              )}

              <ActionDialog
                label="Eliminar compra"
                tone="danger"
                title="Eliminar compra"
                description={`Ticket ${compra.pesaje.folioTicket} — importe $${compra.importeTotal.toString()}. Borra el registro por completo, no se puede deshacer.`}
              >
                <CatalogForm
                  action={eliminarCompra}
                  submitLabel="Eliminar compra"
                  hiddenId={compra.id}
                  fields={[{ name: "motivo", label: "Motivo de la eliminación", required: true, uppercase: true }]}
                />
              </ActionDialog>
            </>
          ) : (
            <p className="text-sm text-muted">
              {compra.estado === "CANCELADA"
                ? "Esta compra ya está cancelada."
                : "No se puede anular ni eliminar: su lote ya tiene ventas que consumen este material."}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
