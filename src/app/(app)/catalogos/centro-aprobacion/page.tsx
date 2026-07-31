import Link from "next/link";
import { prisma } from "@/lib/db";
import { CatalogTable } from "@/components/catalog-table";
import { PageHeader } from "@/components/ui/card";
import { buttonClass } from "@/components/ui/button";
import { EstadoBadge } from "@/components/ui/estado-badge";
import {
  toggleCentroAprobacionActivo,
  marcarCentroAprobacionPredeterminado,
} from "./actions";

export default async function CentroAprobacionPage() {
  const centros = await prisma.centroAprobacion.findMany({
    orderBy: { nombre: "asc" },
  });

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Centro de Aprobación (NetSuite)"
        action={
          <Link
            href="/catalogos/centro-aprobacion/nuevo"
            className={buttonClass("primary", "sm")}
          >
            Nuevo centro
          </Link>
        }
      />
      <p className="text-sm text-muted">
        Corresponde al campo &quot;Centro de Aprobación&quot; (departamento) del
        formulario de Orden de Compra/Venta en NetSuite. El marcado como
        predeterminado es el que se envía en cada Compra/Venta.
      </p>
      <CatalogTable
        rows={centros}
        toggleAction={toggleCentroAprobacionActivo}
        editBasePath="/catalogos/centro-aprobacion"
        columns={[
          { header: "Nombre", cell: (c) => c.nombre },
          { header: "ID en NetSuite", cell: (c) => c.netsuiteId },
          {
            header: "Predeterminado",
            cell: (c) =>
              c.predeterminado ? (
                <EstadoBadge label="Predeterminado" tone="positive" />
              ) : (
                <form action={marcarCentroAprobacionPredeterminado}>
                  <input type="hidden" name="id" value={c.id} />
                  <button type="submit" className={buttonClass("link")}>
                    Marcar como predeterminado
                  </button>
                </form>
              ),
          },
        ]}
      />
    </div>
  );
}
