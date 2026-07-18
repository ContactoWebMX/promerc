import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/dal";
import { prisma } from "@/lib/db";

export default async function LotesPage() {
  const usuario = await getCurrentUser();
  const soloMiUbicacion = usuario.role !== "ADMIN" && usuario.role !== "SUPERVISOR";

  const lotes = await prisma.lote.findMany({
    where: soloMiUbicacion ? { ubicacionId: usuario.ubicacionId ?? -1 } : undefined,
    orderBy: { fecha: "desc" },
    take: 50,
    include: { ubicacion: true, articulo: true, compras: { include: { pesaje: true } } },
  });

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">Lotes</h1>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-black/10 text-left dark:border-white/10">
            <th className="py-2 pr-4 font-medium">Folio</th>
            <th className="py-2 pr-4 font-medium">Ubicación</th>
            <th className="py-2 pr-4 font-medium">Artículo</th>
            <th className="py-2 pr-4 font-medium">Fecha</th>
            <th className="py-2 pr-4 font-medium">Compras</th>
            <th className="py-2 pr-4 font-medium">Total comprado (kg)</th>
            <th className="py-2 pr-4 font-medium">Estado</th>
            <th className="py-2" />
          </tr>
        </thead>
        <tbody>
          {lotes.map((l) => {
            const totalKg = l.compras.reduce(
              (sum, c) => sum + Number(c.pesaje.netoKg ?? 0),
              0,
            );
            return (
              <tr key={l.id} className="border-b border-black/5 dark:border-white/5">
                <td className="py-2 pr-4">
                  {l.folio}
                  {l.folioCorregido && (
                    <span className="ml-1 text-xs text-zinc-500">(corregido)</span>
                  )}
                </td>
                <td className="py-2 pr-4">{l.ubicacion.nombre}</td>
                <td className="py-2 pr-4">{l.articulo.nombre}</td>
                <td className="py-2 pr-4">{l.fecha.toLocaleDateString("es-MX")}</td>
                <td className="py-2 pr-4">{l.compras.length}</td>
                <td className="py-2 pr-4">{totalKg.toFixed(2)}</td>
                <td className="py-2 pr-4">{l.estado}</td>
                <td className="py-2">
                  <Link href={`/lotes/${l.id}`} className="underline">
                    Ver
                  </Link>
                </td>
              </tr>
            );
          })}
          {lotes.length === 0 && (
            <tr>
              <td colSpan={8} className="py-6 text-center text-zinc-500">
                Sin lotes todavía.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
