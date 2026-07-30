import { getCurrentUser } from "@/lib/auth/dal";
import { prisma } from "@/lib/db";
import { buildWorkbook } from "@/lib/export/excel";

const ESTADO_LABELS: Record<string, string> = {
  ABIERTO: "Abierto",
  CERRADO: "Cerrado",
};

export async function GET(request: Request) {
  const usuario = await getCurrentUser();
  const soloMiUbicacion = usuario.role !== "ADMIN" && usuario.role !== "SUPERVISOR";

  const { searchParams } = new URL(request.url);
  const desde = searchParams.get("desde");
  const hasta = searchParams.get("hasta");
  const ubicacionIdParam = searchParams.get("ubicacionId");
  const articuloIdParam = searchParams.get("articuloId");

  const lotes = await prisma.lote.findMany({
    where: {
      ...(soloMiUbicacion
        ? { ubicacionId: usuario.ubicacionId ?? -1 }
        : ubicacionIdParam
          ? { ubicacionId: Number(ubicacionIdParam) }
          : {}),
      ...(articuloIdParam ? { articuloId: Number(articuloIdParam) } : {}),
      ...(desde && hasta
        ? { fecha: { gte: new Date(`${desde}T00:00:00`), lte: new Date(`${hasta}T23:59:59`) } }
        : {}),
    },
    include: {
      ubicacion: true,
      articulo: true,
      compras: { include: { pesaje: true } },
      movimientos: { select: { pesoAsignadoKg: true } },
    },
    orderBy: { fecha: "desc" },
  });

  const rows = lotes.map((l) => {
    const comprado = l.compras
      .filter((c) => c.estado !== "CANCELADA")
      .reduce((sum, c) => sum + Number(c.pesaje.netoKg ?? 0), 0);
    const vendido = l.movimientos.reduce((sum, m) => sum + Number(m.pesoAsignadoKg), 0);
    return {
      Fecha: l.fecha.toLocaleDateString("es-MX"),
      Folio: l.folio,
      Ubicacion: l.ubicacion.nombre,
      Articulo: l.articulo.nombre,
      Comprado_kg: comprado,
      Vendido_kg: vendido,
      Disponible_kg: comprado - vendido,
      Estado: ESTADO_LABELS[l.estado] ?? l.estado,
    };
  });

  const buffer = buildWorkbook([{ name: "Lotes", rows }]);
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="lotes.xlsx"',
    },
  });
}
