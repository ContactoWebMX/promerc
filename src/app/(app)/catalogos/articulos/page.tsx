import Link from "next/link";
import { prisma } from "@/lib/db";
import { CatalogTable } from "@/components/catalog-table";
import { toggleArticuloActivo } from "./actions";

export default async function ArticulosPage() {
  const articulos = await prisma.articulo.findMany({
    orderBy: { nombre: "asc" },
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Artículos</h1>
        <Link href="/catalogos/articulos/nuevo" className="underline">
          Nuevo artículo
        </Link>
      </div>
      <CatalogTable
        rows={articulos}
        toggleAction={toggleArticuloActivo}
        editBasePath="/catalogos/articulos"
        columns={[{ header: "Nombre", cell: (a) => a.nombre }]}
      />
    </div>
  );
}
