import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser, canAccessUbicacion } from "@/lib/auth/dal";
import { CatalogForm } from "@/components/catalog-form";
import { PageHeader } from "@/components/ui/card";
import { crearCompra } from "./actions";

export default async function NuevaCompraPage({
  params,
}: {
  params: Promise<{ pesajeId: string }>;
}) {
  const { pesajeId } = await params;
  const usuario = await getCurrentUser();
  const pesaje = await prisma.pesaje.findUnique({
    where: { id: Number(pesajeId) },
    include: { proveedor: true, articulo: true, compra: true },
  });

  if (!pesaje) notFound();
  if (!canAccessUbicacion(usuario, pesaje.ubicacionId)) notFound();

  if (pesaje.estado !== "COMPLETO" || pesaje.compra) {
    return (
      <div className="flex flex-col gap-2">
        <PageHeader title="No se puede registrar la compra" />
        <p className="text-sm text-muted">
          {pesaje.compra
            ? "Este pesaje ya tiene una compra registrada."
            : "El pesaje debe estar completo (con neto capturado) primero."}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={`Registrar compra — ticket ${pesaje.folioTicket}`} />
      <p className="-mt-3 text-sm text-muted">
        {pesaje.proveedor.nombre} · {pesaje.articulo?.nombre ?? "—"} · Neto:{" "}
        {pesaje.netoKg?.toString()} kg
      </p>
      <CatalogForm
        action={crearCompra}
        submitLabel="Registrar compra"
        hiddenFields={{ pesajeId: pesaje.id }}
        fields={[
          {
            name: "precioUnitarioKg",
            label: "Precio por kg ($)",
            type: "number",
            required: true,
            min: 0,
            step: 0.01,
          },
        ]}
      />
    </div>
  );
}
