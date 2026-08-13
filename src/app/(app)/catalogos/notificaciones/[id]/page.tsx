import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/dal";
import { prisma } from "@/lib/db";
import { CatalogForm } from "@/components/catalog-form";
import { TIPO_NOTIFICACION_LABELS } from "@/lib/notificaciones";
import { saveReglaNotificacion } from "../actions";

export default async function ReglaNotificacionFormPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const usuario = await getCurrentUser();
  if (usuario.role !== "ADMIN") redirect("/catalogos");

  const { id } = await params;
  const isNew = id === "nuevo";

  const [regla, usuarios, ubicaciones] = await Promise.all([
    isNew ? null : prisma.reglaNotificacion.findUnique({ where: { id: Number(id) } }),
    prisma.usuario.findMany({
      where: { activo: true, role: { not: "CLIENTE" } },
      orderBy: { nombre: "asc" },
    }),
    prisma.ubicacion.findMany({ where: { activo: true }, orderBy: { nombre: "asc" } }),
  ]);

  if (!isNew && !regla) notFound();

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">
        {isNew ? "Nueva regla de notificación" : "Editar regla de notificación"}
      </h1>
      <CatalogForm
        action={saveReglaNotificacion}
        submitLabel={isNew ? "Crear" : "Guardar"}
        hiddenId={regla?.id}
        defaultValues={
          regla
            ? {
                tipo: regla.tipo,
                usuarioId: regla.usuarioId.toString(),
                ubicacionId: regla.ubicacionId?.toString() ?? "",
                canalInApp: regla.canalInApp.toString(),
                canalCorreo: regla.canalCorreo.toString(),
              }
            : { canalInApp: "true", canalCorreo: "false" }
        }
        fields={[
          {
            name: "tipo",
            label: "Tipo de evento",
            type: "select",
            required: true,
            options: Object.entries(TIPO_NOTIFICACION_LABELS).map(([value, label]) => ({
              value,
              label,
            })),
          },
          {
            name: "usuarioId",
            label: "Usuario",
            type: "select",
            required: true,
            options: usuarios.map((u) => ({ value: u.id.toString(), label: u.nombre })),
          },
          {
            name: "ubicacionId",
            label: "Ubicación",
            type: "select",
            options: [
              { value: "", label: "Todas" },
              ...ubicaciones.map((u) => ({ value: u.id.toString(), label: u.nombre })),
            ],
            helpText: "Deja \"Todas\" para que aplique sin importar la sede de la operación.",
          },
          {
            name: "canalInApp",
            label: "Notificación in-app",
            type: "select",
            required: true,
            options: [
              { value: "true", label: "Sí" },
              { value: "false", label: "No" },
            ],
          },
          {
            name: "canalCorreo",
            label: "Correo",
            type: "select",
            required: true,
            options: [
              { value: "true", label: "Sí" },
              { value: "false", label: "No" },
            ],
          },
        ]}
      />
    </div>
  );
}
