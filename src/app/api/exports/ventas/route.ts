import { getCurrentUser } from "@/lib/auth/dal";
import { prisma } from "@/lib/db";
import { buildWorkbook } from "@/lib/export/excel";

export async function GET() {
  const usuario = await getCurrentUser();
  const soloMiUbicacion = usuario.role !== "ADMIN" && usuario.role !== "SUPERVISOR";

  const ventas = await prisma.venta.findMany({
    where: soloMiUbicacion ? { ubicacionId: usuario.ubicacionId ?? -1 } : undefined,
    include: { cliente: true, articulo: true, ubicacion: true },
    orderBy: { createdAt: "desc" },
  });

  const rows = ventas.map((v) => ({
    Fecha: v.createdAt.toLocaleDateString("es-MX"),
    Ubicacion: v.ubicacion.nombre,
    Cliente: v.cliente.nombre,
    Articulo: v.articulo.nombre,
    Vendido_kg: Number(v.pesoVendidoKg),
    Reportado_cliente_kg: v.pesoReportadoClienteKg ? Number(v.pesoReportadoClienteKg) : "",
    Penalizacion_kg: Number(v.penalizacionKg),
    Precio_kg: Number(v.precioUnitarioKg),
    Importe: Number(v.importeTotal),
    Tolerancia_excedida: v.toleranciaExcedida ? "Sí" : "No",
    Estado: v.estado,
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
