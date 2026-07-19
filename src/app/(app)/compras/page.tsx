import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/dal";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/ui/card";
import { buttonClass } from "@/components/ui/button";
import { TableWrapper, thClass, tdClass, trClass } from "@/components/ui/table";

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
      <PageHeader
        title="Compras"
        action={
          <Link href="/pesajes" className={buttonClass("secondary", "sm")}>
            Ver pesajes completos para registrar una compra
          </Link>
        }
      />
      <TableWrapper>
        <thead>
          <tr>
            <th className={thClass}>Folio ticket</th>
            <th className={thClass}>Proveedor</th>
            <th className={thClass}>Neto (kg)</th>
            <th className={thClass}>Precio/kg</th>
            <th className={thClass}>Importe</th>
            <th className={thClass}>Lote</th>
            <th className={thClass}>Estado</th>
            <th className={thClass} />
          </tr>
        </thead>
        <tbody>
          {compras.map((c) => (
            <tr key={c.id} className={trClass}>
              <td className={tdClass}>{c.pesaje.folioTicket}</td>
              <td className={tdClass}>{c.proveedor.nombre}</td>
              <td className={tdClass}>{c.pesaje.netoKg?.toString() ?? "—"}</td>
              <td className={tdClass}>{c.precioUnitarioKg.toString()}</td>
              <td className={tdClass}>{c.importeTotal.toString()}</td>
              <td className={tdClass}>
                {c.lote ? (
                  <Link href={`/lotes/${c.lote.id}`} className={buttonClass("link")}>
                    {c.lote.folio}
                  </Link>
                ) : (
                  "—"
                )}
              </td>
              <td className={tdClass}>{c.estado}</td>
              <td className={tdClass}>
                <Link href={`/compras/${c.id}`} className={buttonClass("link")}>
                  Ver
                </Link>
              </td>
            </tr>
          ))}
          {compras.length === 0 && (
            <tr>
              <td colSpan={8} className={`${tdClass} text-center text-muted`}>
                Sin compras todavía.
              </td>
            </tr>
          )}
        </tbody>
      </TableWrapper>
    </div>
  );
}
