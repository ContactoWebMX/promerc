import Link from "next/link";
import { prisma } from "@/lib/db";
import { CatalogTable } from "@/components/catalog-table";
import { PageHeader } from "@/components/ui/card";
import { buttonClass } from "@/components/ui/button";
import { toggleUbicacionActivo } from "./actions";

export default async function UbicacionesPage() {
  const ubicaciones = await prisma.ubicacion.findMany({
    orderBy: { nombre: "asc" },
  });

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Ubicaciones"
        action={
          <Link href="/catalogos/ubicaciones/nuevo" className={buttonClass("primary", "sm")}>
            Nueva ubicación
          </Link>
        }
      />
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
