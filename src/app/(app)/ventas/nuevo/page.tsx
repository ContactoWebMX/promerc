import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/dal";
import { lotesConDisponible } from "@/lib/lote";
import { CatalogForm } from "@/components/catalog-form";
import { PageHeader } from "@/components/ui/card";
import { crearVenta } from "./actions";

export default async function NuevaVentaPage() {
  const usuario = await getCurrentUser();
  const soloMiUbicacion = usuario.role !== "ADMIN" && usuario.role !== "SUPERVISOR";

  const [clientes, lotes] = await Promise.all([
    prisma.cliente.findMany({ where: { activo: true }, orderBy: { nombre: "asc" } }),
    lotesConDisponible(undefined, soloMiUbicacion ? (usuario.ubicacionId ?? -1) : undefined),
  ]);

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Nueva venta" />
      {lotes.length === 0 ? (
        <p className="text-sm text-muted">
          No hay lotes con material disponible para vender todavía.
        </p>
      ) : (
        <CatalogForm
          action={crearVenta}
          submitLabel="Registrar venta"
          defaultValues={{ fechaOperacion: new Date().toISOString().slice(0, 10) }}
          fields={[
            {
              name: "fechaOperacion",
              label: "Fecha de la venta",
              type: "date",
              required: true,
              helpText: "Precargada con hoy — ajústala si la venta se registra en otra fecha.",
            },
            {
              name: "clienteId",
              label: "Cliente",
              type: "select",
              required: true,
              options: clientes.map((c) => ({ value: c.id.toString(), label: c.nombre })),
            },
            {
              name: "loteId",
              label: "Lote",
              type: "combobox",
              required: true,
              helpText: "Escribe el folio o el artículo para buscar entre los lotes abiertos.",
              options: lotes.map((l) => ({
                value: l.id.toString(),
                group: l.articulo.nombre,
                label: soloMiUbicacion
                  ? `${l.articulo.nombre} — ${l.folio} — disponible: ${l.disponible.toFixed(2)} kg`
                  : `${l.articulo.nombre} — ${l.folio} — ${l.ubicacion.nombre} — disponible: ${l.disponible.toFixed(2)} kg`,
              })),
            },
            {
              name: "pesoAsignadoKg",
              label: "Peso a vender (kg)",
              type: "number",
              required: true,
              min: 0,
              step: 0.01,
            },
            {
              name: "precioUnitarioKg",
              label: "Precio por kg ($)",
              type: "number",
              required: true,
              min: 0,
              step: 0.01,
            },
            { name: "operadorNombre", label: "Operador del transporte (opcional)" },
            { name: "placas", label: "Placas (opcional)" },
          ]}
        />
      )}
    </div>
  );
}
