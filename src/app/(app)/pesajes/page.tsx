import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/dal";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/ui/card";
import { buttonClass } from "@/components/ui/button";
import { TableWrapper, thClass, tdClass, trClass } from "@/components/ui/table";

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
      <PageHeader
        title="Pesajes"
        action={
          <Link href="/pesajes/nuevo" className={buttonClass("primary", "sm")}>
            Nuevo pesaje
          </Link>
        }
      />
      <TableWrapper>
        <thead>
          <tr>
            <th className={thClass}>Folio ticket</th>
            <th className={thClass}>Ubicación</th>
            <th className={thClass}>Proveedor</th>
            <th className={thClass}>Artículo</th>
            <th className={thClass}>Tara (kg)</th>
            <th className={thClass}>Neto (kg)</th>
            <th className={thClass}>Estado</th>
            <th className={thClass} />
          </tr>
        </thead>
        <tbody>
          {pesajes.map((p) => (
            <tr key={p.id} className={trClass}>
              <td className={tdClass}>{p.folioTicket}</td>
              <td className={tdClass}>{p.ubicacion.nombre}</td>
              <td className={tdClass}>{p.proveedor.nombre}</td>
              <td className={tdClass}>{p.articulo.nombre}</td>
              <td className={tdClass}>{p.taraKg.toString()}</td>
              <td className={tdClass}>{p.netoKg?.toString() ?? "—"}</td>
              <td className={tdClass}>{ESTADO_LABELS[p.estado] ?? p.estado}</td>
              <td className={tdClass}>
                <Link href={`/pesajes/${p.id}`} className={buttonClass("link")}>
                  Ver
                </Link>
              </td>
            </tr>
          ))}
          {pesajes.length === 0 && (
            <tr>
              <td colSpan={8} className={`${tdClass} text-center text-muted`}>
                Sin pesajes todavía.
              </td>
            </tr>
          )}
        </tbody>
      </TableWrapper>
    </div>
  );
}
