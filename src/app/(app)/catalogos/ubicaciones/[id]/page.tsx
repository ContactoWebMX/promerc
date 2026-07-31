import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { CatalogForm } from "@/components/catalog-form";
import { saveUbicacion } from "../actions";

export default async function UbicacionFormPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const isNew = id === "nuevo";

  const ubicacion = isNew
    ? null
    : await prisma.ubicacion.findUnique({ where: { id: Number(id) } });

  if (!isNew && !ubicacion) notFound();

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">
        {isNew ? "Nueva ubicación" : "Editar ubicación"}
      </h1>
      <CatalogForm
        action={saveUbicacion}
        submitLabel={isNew ? "Crear" : "Guardar"}
        hiddenId={ubicacion?.id}
        defaultValues={
          ubicacion
            ? {
                nombre: ubicacion.nombre,
                codigo: ubicacion.codigo,
                netsuiteLocationId: ubicacion.netsuiteLocationId ?? "",
              }
            : undefined
        }
        fields={[
          { name: "nombre", label: "Nombre", required: true },
          { name: "codigo", label: "Código", required: true },
          {
            name: "netsuiteLocationId",
            label: "ID de Location en NetSuite",
            helpText: "Opcional. Necesario para enviar Compras/Ventas de esta ubicación.",
          },
        ]}
      />
    </div>
  );
}
