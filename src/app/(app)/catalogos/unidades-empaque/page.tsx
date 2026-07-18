import Link from "next/link";
import { prisma } from "@/lib/db";
import { CatalogTable } from "@/components/catalog-table";
import { toggleUnidadEmpaqueActivo } from "./actions";

export default async function UnidadesEmpaquePage() {
  const unidades = await prisma.unidadEmpaque.findMany({
    orderBy: { nombre: "asc" },
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Unidades de empaque</h1>
        <Link href="/catalogos/unidades-empaque/nuevo" className="underline">
          Nueva unidad
        </Link>
      </div>
      <CatalogTable
        rows={unidades}
        toggleAction={toggleUnidadEmpaqueActivo}
        editBasePath="/catalogos/unidades-empaque"
        columns={[{ header: "Nombre", cell: (u) => u.nombre }]}
      />
    </div>
  );
}
