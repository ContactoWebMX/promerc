import { getCurrentUser } from "@/lib/auth/dal";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/ui/card";
import { NuevoPesajeForm } from "./nuevo-pesaje-form";

export default async function NuevoPesajePage() {
  const usuario = await getCurrentUser();

  const [ubicaciones, proveedores, transportistas] = await Promise.all([
    prisma.ubicacion.findMany({ where: { activo: true }, orderBy: { nombre: "asc" } }),
    prisma.proveedor.findMany({ where: { activo: true }, orderBy: { nombre: "asc" } }),
    prisma.transportista.findMany({ orderBy: { nombre: "asc" }, take: 100 }),
  ]);

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Nuevo pesaje — captura de tara" />
      <p className="-mt-3 text-sm text-muted">
        Regístralo cuando el camión pase vacío por la báscula. Como todavía no
        se conoce el artículo (el camión va vacío), se define hasta el cierre.
        El peso cargado se captura después, al cerrar el pesaje.
      </p>
      <NuevoPesajeForm
        ubicaciones={ubicaciones}
        proveedores={proveedores}
        transportistas={transportistas}
        ubicacionDefaultId={usuario.ubicacionId?.toString() ?? ""}
        fechaHoy={new Date().toISOString().slice(0, 10)}
      />
    </div>
  );
}
