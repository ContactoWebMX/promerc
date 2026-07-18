import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { CatalogForm } from "@/components/catalog-form";
import { crearCompra } from "./actions";

export default async function NuevaCompraPage({
  params,
}: {
  params: Promise<{ pesajeId: string }>;
}) {
  const { pesajeId } = await params;
  const pesaje = await prisma.pesaje.findUnique({
    where: { id: Number(pesajeId) },
    include: { proveedor: true, articulo: true, compra: true },
  });

  if (!pesaje) notFound();

  if (pesaje.estado !== "COMPLETO" || pesaje.compra) {
    return (
      <div className="flex flex-col gap-2">
        <h1 className="text-xl font-semibold">No se puede registrar la compra</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          {pesaje.compra
            ? "Este pesaje ya tiene una compra registrada."
            : "El pesaje debe estar completo (con neto capturado) primero."}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">
        Registrar compra — ticket {pesaje.folioTicket}
      </h1>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        {pesaje.proveedor.nombre} · {pesaje.articulo.nombre} · Neto:{" "}
        {pesaje.netoKg?.toString()} kg
      </p>
      <CatalogForm
        action={crearCompra}
        submitLabel="Registrar compra"
        hiddenFields={{ pesajeId: pesaje.id }}
        fields={[
          {
            name: "precioUnitarioKg",
            label: "Precio por kg",
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
