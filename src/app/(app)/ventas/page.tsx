import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/dal";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/ui/card";
import { buttonClass } from "@/components/ui/button";
import { TableWrapper, thClass, tdClass, trClass } from "@/components/ui/table";

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
      <PageHeader
        title="Ventas"
        action={
          <Link href="/ventas/nuevo" className={buttonClass("primary", "sm")}>
            Nueva venta
          </Link>
        }
      />
      <TableWrapper>
        <thead>
          <tr>
            <th className={thClass}>Cliente</th>
            <th className={thClass}>Artículo</th>
            <th className={thClass}>Vendido (kg)</th>
            <th className={thClass}>Importe</th>
            <th className={thClass}>Estado</th>
            <th className={thClass} />
          </tr>
        </thead>
        <tbody>
          {ventas.map((v) => (
            <tr key={v.id} className={trClass}>
              <td className={tdClass}>{v.cliente.nombre}</td>
              <td className={tdClass}>{v.articulo.nombre}</td>
              <td className={tdClass}>{v.pesoVendidoKg.toString()}</td>
              <td className={tdClass}>{v.importeTotal.toString()}</td>
              <td className={tdClass}>
                {v.estado === "PENDIENTE_APROBACION" ? (
                  <span className="rounded-full bg-danger/10 px-2 py-0.5 text-xs font-medium text-danger">
                    {ESTADO_LABELS[v.estado]}
                  </span>
                ) : (
                  ESTADO_LABELS[v.estado] ?? v.estado
                )}
              </td>
              <td className={tdClass}>
                <Link href={`/ventas/${v.id}`} className={buttonClass("link")}>
                  Ver
                </Link>
              </td>
            </tr>
          ))}
          {ventas.length === 0 && (
            <tr>
              <td colSpan={6} className={`${tdClass} text-center text-muted`}>
                Sin ventas todavía.
              </td>
            </tr>
          )}
        </tbody>
      </TableWrapper>
    </div>
  );
}
