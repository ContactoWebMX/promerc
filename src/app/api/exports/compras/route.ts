import { getCurrentUser } from "@/lib/auth/dal";
import { prisma } from "@/lib/db";
import { buildWorkbook } from "@/lib/export/excel";

export async function GET(request: Request) {
  const usuario = await getCurrentUser();
  const soloMiUbicacion = usuario.role !== "ADMIN" && usuario.role !== "SUPERVISOR";

  const { searchParams } = new URL(request.url);
  const desde = searchParams.get("desde");
  const hasta = searchParams.get("hasta");

  const compras = await prisma.compra.findMany({
    where: {
      ...(soloMiUbicacion ? { ubicacionId: usuario.ubicacionId ?? -1 } : {}),
      ...(desde && hasta
        ? {
            fechaOperacion: {
              gte: new Date(`${desde}T00:00:00`),
              lte: new Date(`${hasta}T23:59:59`),
            },
          }
        : {}),
    },
    include: {
      pesaje: { include: { articulo: true } },
      proveedor: true,
      ubicacion: true,
      lote: true,
    },
    orderBy: { fechaOperacion: "desc" },
  });

  const rows = compras.map((c) => ({
    Fecha: c.fechaOperacion.toLocaleDateString("es-MX"),
    Folio_Ticket: c.pesaje.folioTicket,
    Ubicacion: c.ubicacion.nombre,
    Proveedor: c.proveedor.nombre,
    Articulo: c.pesaje.articulo?.nombre ?? "",
    Neto_kg: Number(c.pesaje.netoKg ?? 0),
    Precio_kg: Number(c.precioUnitarioKg),
    Importe: Number(c.importeTotal),
    Lote: c.lote?.folio ?? "",
    Estado: c.estado,
    Folio_NetSuite: c.netsuiteOrderNumber ?? (c.netsuiteOrderId ? "Enviada" : ""),
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
