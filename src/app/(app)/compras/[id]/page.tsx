import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";

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
      <h1 className="text-xl font-semibold">
        Compra — ticket {compra.pesaje.folioTicket}
      </h1>
      <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm max-w-md">
        <dt className="text-zinc-500">Proveedor</dt>
        <dd>{compra.proveedor.nombre}</dd>
        <dt className="text-zinc-500">Ubicación</dt>
        <dd>{compra.ubicacion.nombre}</dd>
        <dt className="text-zinc-500">Neto comprado</dt>
        <dd>{compra.pesaje.netoKg?.toString()} kg</dd>
        <dt className="text-zinc-500">Precio por kg</dt>
        <dd>{compra.precioUnitarioKg.toString()}</dd>
        <dt className="text-zinc-500">Importe total</dt>
        <dd>{compra.importeTotal.toString()}</dd>
        <dt className="text-zinc-500">Estado</dt>
        <dd>{compra.estado}</dd>
        <dt className="text-zinc-500">Lote</dt>
        <dd>
          {compra.lote ? (
            <Link href={`/lotes/${compra.lote.id}`} className="underline">
              {compra.lote.folio}
            </Link>
          ) : (
            "—"
          )}
        </dd>
      </dl>
      <Link href={`/pesajes/${compra.pesajeId}`} className="text-sm underline">
        Ver pesaje de origen
      </Link>
    </div>
  );
}
