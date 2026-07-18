import Link from "next/link";
import { prisma } from "@/lib/db";
import { CatalogTable } from "@/components/catalog-table";
import { toggleProveedorActivo } from "./actions";

export default async function ProveedoresPage() {
  const proveedores = await prisma.proveedor.findMany({
    orderBy: { nombre: "asc" },
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Proveedores</h1>
        <Link href="/catalogos/proveedores/nuevo" className="underline">
          Nuevo proveedor
        </Link>
      </div>
      <CatalogTable
        rows={proveedores}
        toggleAction={toggleProveedorActivo}
        editBasePath="/catalogos/proveedores"
        columns={[
          { header: "Nombre", cell: (p) => p.nombre },
          { header: "RFC", cell: (p) => p.rfc ?? "—" },
          { header: "Teléfono", cell: (p) => p.telefono ?? "—" },
        ]}
      />
    </div>
  );
}
