import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { CatalogForm } from "@/components/catalog-form";
import { saveCentroAprobacion } from "../actions";

export default async function CentroAprobacionFormPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const isNew = id === "nuevo";

  const centro = isNew
    ? null
    : await prisma.centroAprobacion.findUnique({ where: { id: Number(id) } });

  if (!isNew && !centro) notFound();

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">
        {isNew ? "Nuevo Centro de Aprobación" : "Editar Centro de Aprobación"}
      </h1>
      <CatalogForm
        action={saveCentroAprobacion}
        submitLabel={isNew ? "Crear" : "Guardar"}
        hiddenId={centro?.id}
        defaultValues={
          centro
            ? { nombre: centro.nombre, netsuiteId: centro.netsuiteId }
            : undefined
        }
        fields={[
          { name: "nombre", label: "Nombre", required: true },
          {
            name: "netsuiteId",
            label: "ID del Departamento en NetSuite",
            required: true,
            helpText: "El campo \"Centro de Aprobación\" en NetSuite es el departamento (department).",
          },
        ]}
      />
    </div>
  );
}
