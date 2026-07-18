import Link from "next/link";
import { prisma } from "@/lib/db";
import { CatalogTable } from "@/components/catalog-table";
import { toggleUbicacionActivo } from "./actions";

export default async function UbicacionesPage() {
  const ubicaciones = await prisma.ubicacion.findMany({
    orderBy: { nombre: "asc" },
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Ubicaciones</h1>
        <Link href="/catalogos/ubicaciones/nuevo" className="underline">
          Nueva ubicación
        </Link>
      </div>
      <CatalogTable
        rows={ubicaciones}
        toggleAction={toggleUbicacionActivo}
        editBasePath="/catalogos/ubicaciones"
        columns={[
          { header: "Nombre", cell: (u) => u.nombre },
          { header: "Código", cell: (u) => u.codigo },
        ]}
      />
    </div>
  );
}
