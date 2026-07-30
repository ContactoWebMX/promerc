import { getCurrentUser } from "@/lib/auth/dal";
import { prisma } from "@/lib/db";
import { buildWorkbook } from "@/lib/export/excel";

const ESTADO_LABELS: Record<string, string> = {
  TARA_CAPTURADA: "Pendiente de salida",
  CARGA_REGISTRADA: "Cargado — pendiente de báscula",
  COMPLETO: "Completo",
  ANULADO: "Anulado",
};

export async function GET(request: Request) {
  const usuario = await getCurrentUser();
  const soloMiUbicacion = usuario.role !== "ADMIN" && usuario.role !== "SUPERVISOR";

  const { searchParams } = new URL(request.url);
  const desde = searchParams.get("desde");
  const hasta = searchParams.get("hasta");

  const pesajes = await prisma.pesaje.findMany({
    where: {
      ...(soloMiUbicacion ? { ubicacionId: usuario.ubicacionId ?? -1 } : {}),
      ...(desde && hasta
        ? { createdAt: { gte: new Date(`${desde}T00:00:00`), lte: new Date(`${hasta}T23:59:59`) } }
        : {}),
    },
    include: { ubicacion: true, proveedor: true, articulo: true },
    orderBy: { createdAt: "desc" },
  });

  const rows = pesajes.map((p) => ({
    Fecha: p.createdAt.toLocaleDateString("es-MX"),
    Folio_Ticket: p.folioTicket,
    Ubicacion: p.ubicacion.nombre,
    Proveedor: p.proveedor.nombre,
    Articulo: p.articulo?.nombre ?? "",
    Tara_kg: Number(p.taraKg),
    Neto_kg: p.netoKg ? Number(p.netoKg) : "",
    Estado: ESTADO_LABELS[p.estado] ?? p.estado,
  }));

  const buffer = buildWorkbook([{ name: "Pesajes", rows }]);
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="pesajes.xlsx"',
    },
  });
}
