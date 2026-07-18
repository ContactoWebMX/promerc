import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/dal";
import { prisma } from "@/lib/db";
import { CatalogForm } from "@/components/catalog-form";
import { saveUsuario } from "../actions";

const ROLE_LABELS: Record<string, string> = {
  ADMIN: "Administrador",
  SUPERVISOR: "Supervisor",
  OPERADOR: "Operador",
  CLIENTE: "Cliente (portal)",
};

export default async function UsuarioFormPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const currentUser = await getCurrentUser();
  if (currentUser.role !== "ADMIN") redirect("/catalogos");

  const { id } = await params;
  const isNew = id === "nuevo";

  const [usuario, ubicaciones, clientes] = await Promise.all([
    isNew ? null : prisma.usuario.findUnique({ where: { id: Number(id) } }),
    prisma.ubicacion.findMany({ where: { activo: true }, orderBy: { nombre: "asc" } }),
    prisma.cliente.findMany({ where: { activo: true }, orderBy: { nombre: "asc" } }),
  ]);

  if (!isNew && !usuario) notFound();

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">
        {isNew ? "Nuevo usuario" : "Editar usuario"}
      </h1>
      <CatalogForm
        action={saveUsuario}
        submitLabel={isNew ? "Crear" : "Guardar"}
        hiddenId={usuario?.id}
        defaultValues={
          usuario
            ? {
                nombre: usuario.nombre,
                email: usuario.email,
                role: usuario.role,
                ubicacionId: usuario.ubicacionId?.toString() ?? "",
                clienteId: usuario.clienteId?.toString() ?? "",
              }
            : undefined
        }
        fields={[
          { name: "nombre", label: "Nombre", required: true },
          { name: "email", label: "Correo", type: "email", required: true },
          {
            name: "password",
            label: isNew
              ? "Contraseña"
              : "Nueva contraseña",
            type: "password",
            required: isNew,
            helpText: isNew
              ? undefined
              : "Deja en blanco para no cambiar la contraseña actual.",
          },
          {
            name: "role",
            label: "Rol",
            type: "select",
            required: true,
            options: Object.entries(ROLE_LABELS).map(([value, label]) => ({
              value,
              label,
            })),
          },
          {
            name: "ubicacionId",
            label: "Ubicación",
            type: "select",
            helpText: "Sin seleccionar = acceso a todas las ubicaciones.",
            options: ubicaciones.map((u) => ({
              value: u.id.toString(),
              label: u.nombre,
            })),
          },
          {
            name: "clienteId",
            label: "Cliente (solo si el rol es Cliente)",
            type: "select",
            options: clientes.map((c) => ({
              value: c.id.toString(),
              label: c.nombre,
            })),
          },
        ]}
      />
    </div>
  );
}
