import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/dal";
import { prisma } from "@/lib/db";

const ESTADO_LABELS: Record<string, string> = {
  TARA_CAPTURADA: "Pendiente de cierre",
  COMPLETO: "Completo",
  ANULADO: "Anulado",
};

export default async function PesajesPage() {
  const usuario = await getCurrentUser();

  const soloMiUbicacion = usuario.role !== "ADMIN" && usuario.role !== "SUPERVISOR";

  const pesajes = await prisma.pesaje.findMany({
    where: soloMiUbicacion ? { ubicacionId: usuario.ubicacionId ?? -1 } : undefined,
    orderBy: { createdAt: "desc" },
    take: 50,
    include: { ubicacion: true, proveedor: true, articulo: true },
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Pesajes</h1>
        <Link href="/pesajes/nuevo" className="underline">
          Nuevo pesaje
        </Link>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-black/10 text-left dark:border-white/10">
            <th className="py-2 pr-4 font-medium">Folio ticket</th>
            <th className="py-2 pr-4 font-medium">Ubicación</th>
            <th className="py-2 pr-4 font-medium">Proveedor</th>
            <th className="py-2 pr-4 font-medium">Artículo</th>
            <th className="py-2 pr-4 font-medium">Tara (kg)</th>
            <th className="py-2 pr-4 font-medium">Neto (kg)</th>
            <th className="py-2 pr-4 font-medium">Estado</th>
            <th className="py-2" />
          </tr>
        </thead>
        <tbody>
          {pesajes.map((p) => (
            <tr key={p.id} className="border-b border-black/5 dark:border-white/5">
              <td className="py-2 pr-4">{p.folioTicket}</td>
              <td className="py-2 pr-4">{p.ubicacion.nombre}</td>
              <td className="py-2 pr-4">{p.proveedor.nombre}</td>
              <td className="py-2 pr-4">{p.articulo.nombre}</td>
              <td className="py-2 pr-4">{p.taraKg.toString()}</td>
              <td className="py-2 pr-4">{p.netoKg?.toString() ?? "—"}</td>
              <td className="py-2 pr-4">{ESTADO_LABELS[p.estado] ?? p.estado}</td>
              <td className="py-2">
                <Link href={`/pesajes/${p.id}`} className="underline">
                  Ver
                </Link>
              </td>
            </tr>
          ))}
          {pesajes.length === 0 && (
            <tr>
              <td colSpan={8} className="py-6 text-center text-zinc-500">
                Sin pesajes todavía.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
