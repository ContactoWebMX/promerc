import { getCurrentUser } from "@/lib/auth/dal";
import { prisma } from "@/lib/db";
import { buildWorkbook } from "@/lib/export/excel";

export async function GET(request: Request) {
  const usuario = await getCurrentUser();
  const soloMiUbicacion = usuario.role !== "ADMIN" && usuario.role !== "SUPERVISOR";

  const { searchParams } = new URL(request.url);
  const desde = searchParams.get("desde");
  const hasta = searchParams.get("hasta");

  const rangoFecha =
    desde && hasta
      ? { gte: new Date(`${desde}T00:00:00`), lte: new Date(`${hasta}T23:59:59`) }
      : undefined;

  const ventas = await prisma.venta.findMany({
    where: {
      ...(soloMiUbicacion ? { ubicacionId: usuario.ubicacionId ?? -1 } : {}),
      ...(rangoFecha
        ? { OR: [{ pesoReportadoEn: rangoFecha }, { pesoReportadoEn: null, createdAt: rangoFecha }] }
        : {}),
    },
    include: { cliente: true, articulo: true, ubicacion: true },
    orderBy: { pesoReportadoEn: { sort: "desc", nulls: "last" } },
  });

  const rows = ventas.map((v) => ({
    Fecha: (v.pesoReportadoEn ?? v.createdAt).toLocaleDateString("es-MX"),
    Ubicacion: v.ubicacion.nombre,
    Cliente: v.cliente.nombre,
    Articulo: v.articulo.nombre,
    Vendido_kg: Number(v.pesoVendidoKg),
    Reportado_cliente_kg: v.pesoReportadoClienteKg ? Number(v.pesoReportadoClienteKg) : "",
    Diferencia_kg: Number(v.diferenciaKg),
    Precio_kg: Number(v.precioUnitarioKg),
    Importe: Number(v.importeTotal),
    Tolerancia_excedida: v.toleranciaExcedida ? "Sí" : "No",
    Estado: v.estado,
    Folio_NetSuite: v.netsuiteOrderNumber ?? (v.netsuiteOrderId ? "Enviada" : ""),
  }));

  const buffer = buildWorkbook([{ name: "Ventas", rows }]);
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="ventas.xlsx"',
    },
  });
}
