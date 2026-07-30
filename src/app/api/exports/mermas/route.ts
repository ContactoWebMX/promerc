import { getCurrentUser } from "@/lib/auth/dal";
import { prisma } from "@/lib/db";
import { buildWorkbook } from "@/lib/export/excel";
import { calcularDiferenciaPorcentual } from "@/lib/tolerancia";

export async function GET(request: Request) {
  const usuario = await getCurrentUser();
  const soloMiUbicacion = usuario.role !== "ADMIN" && usuario.role !== "SUPERVISOR";

  const { searchParams } = new URL(request.url);
  const desde = searchParams.get("desde");
  const hasta = searchParams.get("hasta");
  const tipoParam = searchParams.get("tipo");

  const ventas = await prisma.venta.findMany({
    where: {
      ...(soloMiUbicacion ? { ubicacionId: usuario.ubicacionId ?? -1 } : {}),
      diferenciaKg: { not: 0 },
      ...(desde && hasta
        ? { createdAt: { gte: new Date(`${desde}T00:00:00`), lte: new Date(`${hasta}T23:59:59`) } }
        : {}),
    },
    include: {
      cliente: true,
      articulo: true,
      movimientos: { include: { lote: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const rows = ventas
    .map((v) => {
      const diferenciaKg = Number(v.diferenciaKg);
      const tipo = diferenciaKg > 0 ? "MERMA" : "SOBRANTE";
      return {
        Fecha: v.createdAt.toLocaleDateString("es-MX"),
        Cliente: v.cliente.nombre,
        Lotes: [...new Set(v.movimientos.map((m) => m.lote.folio))].join(", "),
        Articulo: v.articulo.nombre,
        Diferencia_kg: diferenciaKg,
        Diferencia_pct: v.pesoReportadoClienteKg
          ? Number(
              calcularDiferenciaPorcentual(
                Number(v.pesoVendidoKg),
                Number(v.pesoReportadoClienteKg),
              ).toFixed(1),
            )
          : 0,
        Diferencia_monto: Number((diferenciaKg * Number(v.precioUnitarioKg)).toFixed(2)),
        Tipo: tipo,
        Tolerancia_excedida: v.toleranciaExcedida ? "Sí" : "No",
        Motivo: v.motivoDiferencia ?? "",
      };
    })
    .filter((r) => !tipoParam || r.Tipo === tipoParam);

  const buffer = buildWorkbook([{ name: "Mermas", rows }]);
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="mermas.xlsx"',
    },
  });
}
