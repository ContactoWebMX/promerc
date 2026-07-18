import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/dal";
import { prisma } from "@/lib/db";

export default async function ComprasPage() {
  const usuario = await getCurrentUser();
  const soloMiUbicacion = usuario.role !== "ADMIN" && usuario.role !== "SUPERVISOR";

  const compras = await prisma.compra.findMany({
    where: soloMiUbicacion ? { ubicacionId: usuario.ubicacionId ?? -1 } : undefined,
    orderBy: { createdAt: "desc" },
    take: 50,
    include: { pesaje: true, proveedor: true, lote: true },
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Compras</h1>
        <Link href="/pesajes" className="underline text-sm">
          Ver pesajes completos para registrar una compra
        </Link>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-black/10 text-left dark:border-white/10">
            <th className="py-2 pr-4 font-medium">Folio ticket</th>
            <th className="py-2 pr-4 font-medium">Proveedor</th>
            <th className="py-2 pr-4 font-medium">Neto (kg)</th>
            <th className="py-2 pr-4 font-medium">Precio/kg</th>
            <th className="py-2 pr-4 font-medium">Importe</th>
            <th className="py-2 pr-4 font-medium">Lote</th>
            <th className="py-2 pr-4 font-medium">Estado</th>
            <th className="py-2" />
          </tr>
        </thead>
        <tbody>
          {compras.map((c) => (
            <tr key={c.id} className="border-b border-black/5 dark:border-white/5">
              <td className="py-2 pr-4">{c.pesaje.folioTicket}</td>
              <td className="py-2 pr-4">{c.proveedor.nombre}</td>
              <td className="py-2 pr-4">{c.pesaje.netoKg?.toString() ?? "—"}</td>
              <td className="py-2 pr-4">{c.precioUnitarioKg.toString()}</td>
              <td className="py-2 pr-4">{c.importeTotal.toString()}</td>
              <td className="py-2 pr-4">
                {c.lote ? (
                  <Link href={`/lotes/${c.lote.id}`} className="underline">
                    {c.lote.folio}
                  </Link>
                ) : (
                  "—"
                )}
              </td>
              <td className="py-2 pr-4">{c.estado}</td>
              <td className="py-2">
                <Link href={`/compras/${c.id}`} className="underline">
                  Ver
                </Link>
              </td>
            </tr>
          ))}
          {compras.length === 0 && (
            <tr>
              <td colSpan={8} className="py-6 text-center text-zinc-500">
                Sin compras todavía.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
