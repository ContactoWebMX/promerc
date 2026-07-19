import Link from "next/link";
import { prisma } from "@/lib/db";
import { CatalogTable } from "@/components/catalog-table";
import { PageHeader } from "@/components/ui/card";
import { buttonClass } from "@/components/ui/button";
import { toggleClienteActivo } from "./actions";

export default async function ClientesPage() {
  const clientes = await prisma.cliente.findMany({
    orderBy: { nombre: "asc" },
  });

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Clientes"
        action={
          <Link href="/catalogos/clientes/nuevo" className={buttonClass("primary", "sm")}>
            Nuevo cliente
          </Link>
        }
      />
      <CatalogTable
        rows={clientes}
        toggleAction={toggleClienteActivo}
        editBasePath="/catalogos/clientes"
        columns={[
          { header: "Nombre", cell: (c) => c.nombre },
          { header: "RFC", cell: (c) => c.rfc ?? "—" },
          { header: "Teléfono", cell: (c) => c.telefono ?? "—" },
        ]}
      />
    </div>
  );
}
