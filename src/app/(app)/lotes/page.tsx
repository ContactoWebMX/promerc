import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/dal";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/ui/card";
import { buttonClass } from "@/components/ui/button";
import { TableWrapper, thClass, tdClass, trClass } from "@/components/ui/table";

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
      <PageHeader title="Lotes" />
      <TableWrapper>
        <thead>
          <tr>
            <th className={thClass}>Folio</th>
            <th className={thClass}>Ubicación</th>
            <th className={thClass}>Artículo</th>
            <th className={thClass}>Fecha</th>
            <th className={thClass}>Compras</th>
            <th className={thClass}>Total comprado (kg)</th>
            <th className={thClass}>Estado</th>
            <th className={thClass} />
          </tr>
        </thead>
        <tbody>
          {lotes.map((l) => {
            const totalKg = l.compras.reduce(
              (sum, c) => sum + Number(c.pesaje.netoKg ?? 0),
              0,
            );
            return (
              <tr key={l.id} className={trClass}>
                <td className={tdClass}>
                  {l.folio}
                  {l.folioCorregido && (
                    <span className="ml-1 text-xs text-muted">(corregido)</span>
                  )}
                </td>
                <td className={tdClass}>{l.ubicacion.nombre}</td>
                <td className={tdClass}>{l.articulo.nombre}</td>
                <td className={tdClass}>{l.fecha.toLocaleDateString("es-MX")}</td>
                <td className={tdClass}>{l.compras.length}</td>
                <td className={tdClass}>{totalKg.toFixed(2)}</td>
                <td className={tdClass}>{l.estado}</td>
                <td className={tdClass}>
                  <Link href={`/lotes/${l.id}`} className={buttonClass("link")}>
                    Ver
                  </Link>
                </td>
              </tr>
            );
          })}
          {lotes.length === 0 && (
            <tr>
              <td colSpan={8} className={`${tdClass} text-center text-muted`}>
                Sin lotes todavía.
              </td>
            </tr>
          )}
        </tbody>
      </TableWrapper>
    </div>
  );
}
