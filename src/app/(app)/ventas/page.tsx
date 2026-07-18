import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/dal";
import { prisma } from "@/lib/db";

const ESTADO_LABELS: Record<string, string> = {
  BORRADOR: "Falta reportar peso",
  PENDIENTE_APROBACION: "Tolerancia excedida — pendiente",
  CERRADA: "Cerrada",
  CANCELADA: "Cancelada",
};

export default async function VentasPage() {
  const usuario = await getCurrentUser();
  const soloMiUbicacion = usuario.role !== "ADMIN" && usuario.role !== "SUPERVISOR";

  const ventas = await prisma.venta.findMany({
    where: soloMiUbicacion ? { ubicacionId: usuario.ubicacionId ?? -1 } : undefined,
    orderBy: { createdAt: "desc" },
    take: 50,
    include: { cliente: true, articulo: true },
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Ventas</h1>
        <Link href="/ventas/nuevo" className="underline">
          Nueva venta
        </Link>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-black/10 text-left dark:border-white/10">
            <th className="py-2 pr-4 font-medium">Cliente</th>
            <th className="py-2 pr-4 font-medium">Artículo</th>
            <th className="py-2 pr-4 font-medium">Vendido (kg)</th>
            <th className="py-2 pr-4 font-medium">Importe</th>
            <th className="py-2 pr-4 font-medium">Estado</th>
            <th className="py-2" />
          </tr>
        </thead>
        <tbody>
          {ventas.map((v) => (
            <tr key={v.id} className="border-b border-black/5 dark:border-white/5">
              <td className="py-2 pr-4">{v.cliente.nombre}</td>
              <td className="py-2 pr-4">{v.articulo.nombre}</td>
              <td className="py-2 pr-4">{v.pesoVendidoKg.toString()}</td>
              <td className="py-2 pr-4">{v.importeTotal.toString()}</td>
              <td className="py-2 pr-4">{ESTADO_LABELS[v.estado] ?? v.estado}</td>
              <td className="py-2">
                <Link href={`/ventas/${v.id}`} className="underline">
                  Ver
                </Link>
              </td>
            </tr>
          ))}
          {ventas.length === 0 && (
            <tr>
              <td colSpan={6} className="py-6 text-center text-zinc-500">
                Sin ventas todavía.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
