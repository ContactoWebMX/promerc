import Link from "next/link";
import { prisma } from "@/lib/db";
import { CatalogTable } from "@/components/catalog-table";
import { toggleClienteActivo } from "./actions";

export default async function ClientesPage() {
  const clientes = await prisma.cliente.findMany({
    orderBy: { nombre: "asc" },
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Clientes</h1>
        <Link href="/catalogos/clientes/nuevo" className="underline">
          Nuevo cliente
        </Link>
      </div>
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
