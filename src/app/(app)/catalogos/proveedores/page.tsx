import Link from "next/link";
import { prisma } from "@/lib/db";
import { CatalogTable } from "@/components/catalog-table";
import { PageHeader } from "@/components/ui/card";
import { buttonClass } from "@/components/ui/button";
import { toggleProveedorActivo } from "./actions";

export default async function ProveedoresPage() {
  const proveedores = await prisma.proveedor.findMany({
    orderBy: { nombre: "asc" },
  });

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Proveedores"
        action={
          <Link href="/catalogos/proveedores/nuevo" className={buttonClass("primary", "sm")}>
            Nuevo proveedor
          </Link>
        }
      />
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
