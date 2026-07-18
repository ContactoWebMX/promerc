import { getCurrentUser } from "@/lib/auth/dal";
import { prisma } from "@/lib/db";
import { buildWorkbook } from "@/lib/export/excel";

export async function GET() {
  const usuario = await getCurrentUser();
  const soloMiUbicacion = usuario.role !== "ADMIN" && usuario.role !== "SUPERVISOR";

  const compras = await prisma.compra.findMany({
    where: soloMiUbicacion ? { ubicacionId: usuario.ubicacionId ?? -1 } : undefined,
    include: { pesaje: true, proveedor: true, ubicacion: true, lote: true },
    orderBy: { createdAt: "desc" },
  });

  const rows = compras.map((c) => ({
    Fecha: c.createdAt.toLocaleDateString("es-MX"),
    Folio_Ticket: c.pesaje.folioTicket,
    Ubicacion: c.ubicacion.nombre,
    Proveedor: c.proveedor.nombre,
    Neto_kg: Number(c.pesaje.netoKg ?? 0),
    Precio_kg: Number(c.precioUnitarioKg),
    Importe: Number(c.importeTotal),
    Lote: c.lote?.folio ?? "",
    Estado: c.estado,
  }));

  const buffer = buildWorkbook([{ name: "Compras", rows }]);
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="compras.xlsx"',
    },
  });
}
