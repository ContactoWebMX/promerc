import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { Card, PageHeader } from "@/components/ui/card";
import { buttonClass } from "@/components/ui/button";

export default async function CompraDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const compra = await prisma.compra.findUnique({
    where: { id: Number(id) },
    include: {
      pesaje: true,
      proveedor: true,
      ubicacion: true,
      lote: true,
    },
  });

  if (!compra) notFound();

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={`Compra — ticket ${compra.pesaje.folioTicket}`} />
      <Card>
        <dl className="grid grid-cols-1 gap-x-6 gap-y-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <dt className="text-muted">Proveedor</dt>
          <dd>{compra.proveedor.nombre}</dd>
          <dt className="text-muted">Ubicación</dt>
          <dd>{compra.ubicacion.nombre}</dd>
          <dt className="text-muted">Neto comprado</dt>
          <dd>{compra.pesaje.netoKg?.toString()} kg</dd>
          <dt className="text-muted">Precio por kg</dt>
          <dd>{compra.precioUnitarioKg.toString()}</dd>
          <dt className="text-muted">Importe total</dt>
          <dd className="font-semibold">{compra.importeTotal.toString()}</dd>
          <dt className="text-muted">Estado</dt>
          <dd>{compra.estado}</dd>
          <dt className="text-muted">Lote</dt>
          <dd>
            {compra.lote ? (
              <Link href={`/lotes/${compra.lote.id}`} className={buttonClass("link")}>
                {compra.lote.folio}
              </Link>
            ) : (
              "—"
            )}
          </dd>
        </dl>
      </Card>
      <Link href={`/pesajes/${compra.pesajeId}`} className={buttonClass("secondary")}>
        Ver pesaje de origen
      </Link>
    </div>
  );
}
