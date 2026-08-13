import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/dal";
import { prisma } from "@/lib/db";
import { CatalogTable } from "@/components/catalog-table";
import { PageHeader } from "@/components/ui/card";
import { buttonClass } from "@/components/ui/button";
import { TIPO_NOTIFICACION_LABELS } from "@/lib/notificaciones";
import { toggleReglaNotificacionActivo } from "./actions";

export default async function NotificacionesCatalogoPage() {
  const usuario = await getCurrentUser();
  if (usuario.role !== "ADMIN") redirect("/catalogos");

  const reglas = await prisma.reglaNotificacion.findMany({
    include: { usuario: true, ubicacion: true },
    orderBy: [{ tipo: "asc" }, { id: "asc" }],
  });

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Notificaciones"
        action={
          <Link href="/catalogos/notificaciones/nuevo" className={buttonClass("primary", "sm")}>
            Nueva regla
          </Link>
        }
      />
      <p className="text-sm text-muted">
        Quién recibe la campanita y/o el correo cuando se completa un
        pesaje, se registra una compra, o se cierra/requiere aprobación una
        venta.
      </p>
      <CatalogTable
        rows={reglas}
        toggleAction={toggleReglaNotificacionActivo}
        editBasePath="/catalogos/notificaciones"
        columns={[
          { header: "Tipo", cell: (r) => TIPO_NOTIFICACION_LABELS[r.tipo] },
          { header: "Usuario", cell: (r) => r.usuario.nombre },
          { header: "Ubicación", cell: (r) => r.ubicacion?.nombre ?? "Todas" },
          { header: "In-app", cell: (r) => (r.canalInApp ? "Sí" : "No") },
          { header: "Correo", cell: (r) => (r.canalCorreo ? "Sí" : "No") },
        ]}
      />
    </div>
  );
}
