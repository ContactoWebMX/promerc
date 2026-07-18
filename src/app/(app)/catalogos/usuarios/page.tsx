import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/dal";
import { prisma } from "@/lib/db";
import { CatalogTable } from "@/components/catalog-table";
import { toggleUsuarioActivo } from "./actions";

export default async function UsuariosPage() {
  const usuario = await getCurrentUser();
  if (usuario.role !== "ADMIN") redirect("/catalogos");

  const usuarios = await prisma.usuario.findMany({
    orderBy: { nombre: "asc" },
    include: { ubicacion: true },
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Usuarios</h1>
        <Link href="/catalogos/usuarios/nuevo" className="underline">
          Nuevo usuario
        </Link>
      </div>
      <CatalogTable
        rows={usuarios}
        toggleAction={toggleUsuarioActivo}
        editBasePath="/catalogos/usuarios"
        columns={[
          { header: "Nombre", cell: (u) => u.nombre },
          { header: "Correo", cell: (u) => u.email },
          { header: "Rol", cell: (u) => u.role },
          { header: "Ubicación", cell: (u) => u.ubicacion?.nombre ?? "Todas" },
        ]}
      />
    </div>
  );
}
