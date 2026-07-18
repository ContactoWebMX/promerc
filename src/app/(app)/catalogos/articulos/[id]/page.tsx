import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { CatalogForm } from "@/components/catalog-form";
import { saveArticulo } from "../actions";

export default async function ArticuloFormPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const isNew = id === "nuevo";

  const articulo = isNew
    ? null
    : await prisma.articulo.findUnique({ where: { id: Number(id) } });

  if (!isNew && !articulo) notFound();

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">
        {isNew ? "Nuevo artículo" : "Editar artículo"}
      </h1>
      <CatalogForm
        action={saveArticulo}
        submitLabel={isNew ? "Crear" : "Guardar"}
        hiddenId={articulo?.id}
        defaultValues={articulo ? { nombre: articulo.nombre } : undefined}
        fields={[{ name: "nombre", label: "Nombre", required: true }]}
      />
    </div>
  );
}
