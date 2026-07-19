import Link from "next/link";
import { prisma } from "@/lib/db";
import { CatalogTable } from "@/components/catalog-table";
import { PageHeader } from "@/components/ui/card";
import { buttonClass } from "@/components/ui/button";
import { toggleArticuloActivo } from "./actions";

export default async function ArticulosPage() {
  const articulos = await prisma.articulo.findMany({
    orderBy: { nombre: "asc" },
  });

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Artículos"
        action={
          <Link href="/catalogos/articulos/nuevo" className={buttonClass("primary", "sm")}>
            Nuevo artículo
          </Link>
        }
      />
      <CatalogTable
        rows={articulos}
        toggleAction={toggleArticuloActivo}
        editBasePath="/catalogos/articulos"
        columns={[{ header: "Nombre", cell: (a) => a.nombre }]}
      />
    </div>
  );
}
