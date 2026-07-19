import Link from "next/link";
import { prisma } from "@/lib/db";
import { CatalogTable } from "@/components/catalog-table";
import { PageHeader } from "@/components/ui/card";
import { buttonClass } from "@/components/ui/button";
import { toggleUnidadEmpaqueActivo } from "./actions";

export default async function UnidadesEmpaquePage() {
  const unidades = await prisma.unidadEmpaque.findMany({
    orderBy: { nombre: "asc" },
  });

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Unidades de empaque"
        action={
          <Link href="/catalogos/unidades-empaque/nuevo" className={buttonClass("primary", "sm")}>
            Nueva unidad
          </Link>
        }
      />
      <CatalogTable
        rows={unidades}
        toggleAction={toggleUnidadEmpaqueActivo}
        editBasePath="/catalogos/unidades-empaque"
        columns={[{ header: "Nombre", cell: (u) => u.nombre }]}
      />
    </div>
  );
}
