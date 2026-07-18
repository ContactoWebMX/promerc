import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { CatalogForm } from "@/components/catalog-form";
import { saveProveedor } from "../actions";

export default async function ProveedorFormPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const isNew = id === "nuevo";

  const proveedor = isNew
    ? null
    : await prisma.proveedor.findUnique({ where: { id: Number(id) } });

  if (!isNew && !proveedor) notFound();

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">
        {isNew ? "Nuevo proveedor" : "Editar proveedor"}
      </h1>
      <CatalogForm
        action={saveProveedor}
        submitLabel={isNew ? "Crear" : "Guardar"}
        hiddenId={proveedor?.id}
        defaultValues={
          proveedor
            ? {
                nombre: proveedor.nombre,
                rfc: proveedor.rfc ?? "",
                telefono: proveedor.telefono ?? "",
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
