import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { CatalogForm } from "@/components/catalog-form";
import { saveUnidadEmpaque } from "../actions";

export default async function UnidadEmpaqueFormPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const isNew = id === "nuevo";

  const unidad = isNew
    ? null
    : await prisma.unidadEmpaque.findUnique({ where: { id: Number(id) } });

  if (!isNew && !unidad) notFound();

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">
        {isNew ? "Nueva unidad de empaque" : "Editar unidad de empaque"}
      </h1>
      <CatalogForm
        action={saveUnidadEmpaque}
        submitLabel={isNew ? "Crear" : "Guardar"}
        hiddenId={unidad?.id}
        defaultValues={unidad ? { nombre: unidad.nombre } : undefined}
        fields={[{ name: "nombre", label: "Nombre", required: true }]}
      />
    </div>
  );
}
