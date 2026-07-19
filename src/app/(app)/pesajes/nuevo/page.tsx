import { getCurrentUser } from "@/lib/auth/dal";
import { prisma } from "@/lib/db";
import { CatalogForm } from "@/components/catalog-form";
import { PageHeader } from "@/components/ui/card";
import { crearPesaje } from "./actions";

export default async function NuevoPesajePage() {
  const usuario = await getCurrentUser();

  const [ubicaciones, articulos, proveedores, transportistas] = await Promise.all([
    prisma.ubicacion.findMany({ where: { activo: true }, orderBy: { nombre: "asc" } }),
    prisma.articulo.findMany({ where: { activo: true }, orderBy: { nombre: "asc" } }),
    prisma.proveedor.findMany({ where: { activo: true }, orderBy: { nombre: "asc" } }),
    prisma.transportista.findMany({ orderBy: { nombre: "asc" }, take: 100 }),
  ]);

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Nuevo pesaje — captura de tara" />
      <p className="-mt-3 text-sm text-muted">
        Regístralo cuando el camión pase vacío por la báscula. El peso cargado
        se captura después, al cerrar el pesaje.
      </p>
      <CatalogForm
        action={crearPesaje}
        submitLabel="Registrar tara"
        defaultValues={{
          ubicacionId: usuario.ubicacionId?.toString() ?? "",
        }}
        fields={[
          { name: "folioTicket", label: "Folio del ticket de báscula", required: true },
          {
            name: "ubicacionId",
            label: "Ubicación",
            type: "select",
            required: true,
            options: ubicaciones.map((u) => ({ value: u.id.toString(), label: u.nombre })),
          },
          {
            name: "articuloId",
            label: "Artículo",
            type: "select",
            required: true,
            options: articulos.map((a) => ({ value: a.id.toString(), label: a.nombre })),
          },
          {
            name: "proveedorId",
            label: "Proveedor",
            type: "select",
            required: true,
            options: proveedores.map((p) => ({ value: p.id.toString(), label: p.nombre })),
          },
          {
            name: "operadorNombre",
            label: "Nombre del operador (transportista)",
            required: true,
            datalist: [...new Set(transportistas.map((t) => t.nombre))],
          },
          {
            name: "placas",
            label: "Placas",
            required: true,
            datalist: [...new Set(transportistas.map((t) => t.placas))],
          },
          { name: "colorCamion", label: "Color del camión" },
          { name: "tipoCamion", label: "Tipo de camión (ej. Trailer)" },
          {
            name: "taraKg",
            label: "Tara (kg) — camión vacío",
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
