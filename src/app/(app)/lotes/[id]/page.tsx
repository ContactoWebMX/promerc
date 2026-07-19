import { notFound } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/dal";
import { prisma } from "@/lib/db";
import { CatalogForm } from "@/components/catalog-form";
import { Card, PageHeader } from "@/components/ui/card";
import { buttonClass } from "@/components/ui/button";
import { corregirFolioLote } from "./actions";

export default async function LoteDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const usuario = await getCurrentUser();
  const { id } = await params;
  const loteId = Number(id);

  const [lote, auditoria] = await Promise.all([
    prisma.lote.findUnique({
      where: { id: loteId },
      include: {
        ubicacion: true,
        articulo: true,
        compras: { include: { pesaje: true, proveedor: true } },
      },
    }),
    prisma.auditLog.findMany({
      where: { entidad: "Lote", entidadId: loteId },
      include: { usuario: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  if (!lote) notFound();

  const totalKg = lote.compras.reduce(
    (sum, c) => sum + Number(c.pesaje.netoKg ?? 0),
    0,
  );
  const puedeCorregir = usuario.role === "ADMIN" || usuario.role === "SUPERVISOR";

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={`Lote ${lote.folio}`} />
      <p className="-mt-4 text-sm text-muted">
        {lote.ubicacion.nombre} · {lote.articulo.nombre} ·{" "}
        {lote.fecha.toLocaleDateString("es-MX")} · Estado: {lote.estado}
      </p>

      <Card className="text-sm">
        <p className="font-medium">
          Compras en este lote ({lote.compras.length}) — total{" "}
          <span className="font-semibold">{totalKg.toFixed(2)} kg</span>
        </p>
        <ul className="mt-2 list-disc pl-5">
          {lote.compras.map((c) => (
            <li key={c.id}>
              <Link href={`/compras/${c.id}`} className={buttonClass("link")}>
                {c.pesaje.folioTicket}
              </Link>{" "}
              — {c.proveedor.nombre} — {c.pesaje.netoKg?.toString()} kg
            </li>
          ))}
          {lote.compras.length === 0 && <li>Sin compras asignadas todavía.</li>}
        </ul>
      </Card>

      {puedeCorregir && (
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium">Corregir folio</p>
          <CatalogForm
            action={corregirFolioLote}
            submitLabel="Guardar corrección"
            hiddenId={lote.id}
            defaultValues={{ folio: lote.folio }}
            fields={[
              { name: "folio", label: "Folio", required: true },
              { name: "motivo", label: "Motivo del cambio", required: true },
            ]}
          />
        </div>
      )}

      {auditoria.length > 0 && (
        <div className="text-sm">
          <p className="font-medium">Historial de cambios</p>
          <ul className="list-disc pl-5">
            {auditoria.map((a) => (
              <li key={a.id}>
                {a.createdAt.toLocaleString("es-MX")} — {a.usuario.nombre}:{" "}
                {a.accion} ({a.motivo})
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
