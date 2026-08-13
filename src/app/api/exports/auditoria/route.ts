import { requireRole } from "@/lib/auth/dal";
import { prisma } from "@/lib/db";
import { buildWorkbook } from "@/lib/export/excel";
import { ACCIONES_AUDITORIA } from "@/lib/audit";

export async function GET(request: Request) {
  await requireRole(["ADMIN", "SUPERVISOR"]);

  const { searchParams } = new URL(request.url);
  const desde = searchParams.get("desde");
  const hasta = searchParams.get("hasta");
  const entidad = searchParams.get("entidad");
  const accion = searchParams.get("accion");
  const usuarioIdParam = searchParams.get("usuarioId");

  const registros = await prisma.auditLog.findMany({
    where: {
      ...(desde && hasta
        ? {
            createdAt: {
              gte: new Date(`${desde}T00:00:00`),
              lte: new Date(`${hasta}T23:59:59`),
            },
          }
        : {}),
      ...(entidad ? { entidad } : {}),
      ...(accion ? { accion } : {}),
      ...(usuarioIdParam ? { usuarioId: Number(usuarioIdParam) } : {}),
    },
    include: { usuario: { select: { nombre: true } } },
    orderBy: { createdAt: "desc" },
  });

  const rows = registros.map((r) => ({
    Fecha: r.createdAt.toLocaleString("es-MX"),
    Usuario: r.usuario.nombre,
    Entidad: r.entidad,
    Accion: ACCIONES_AUDITORIA[r.accion] ?? r.accion,
    Motivo: r.motivo ?? "",
    DetalleAnterior: r.detalleAnterior ? JSON.stringify(r.detalleAnterior) : "",
    DetalleNuevo: r.detalleNuevo ? JSON.stringify(r.detalleNuevo) : "",
  }));

  const buffer = buildWorkbook([{ name: "Auditoria", rows }]);
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="auditoria.xlsx"',
    },
  });
}
