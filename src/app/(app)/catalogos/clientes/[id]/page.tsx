import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { CatalogForm } from "@/components/catalog-form";
import { saveCliente } from "../actions";

export default async function ClienteFormPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const isNew = id === "nuevo";

  const cliente = isNew
    ? null
    : await prisma.cliente.findUnique({ where: { id: Number(id) } });

  if (!isNew && !cliente) notFound();

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">
        {isNew ? "Nuevo cliente" : "Editar cliente"}
      </h1>
      <CatalogForm
        action={saveCliente}
        submitLabel={isNew ? "Crear" : "Guardar"}
        hiddenId={cliente?.id}
        defaultValues={
          cliente
            ? {
                nombre: cliente.nombre,
                rfc: cliente.rfc ?? "",
                telefono: cliente.telefono ?? "",
              }
            : undefined
        }
        fields={[
          { name: "nombre", label: "Nombre", required: true },
          { name: "rfc", label: "RFC" },
          { name: "telefono", label: "Teléfono" },
        ]}
      />
    </div>
  );
}
