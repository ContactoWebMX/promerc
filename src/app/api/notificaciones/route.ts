import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/dal";
import { prisma } from "@/lib/db";
import { resumenParaRol } from "@/lib/notificaciones";
import { rutaRegistro } from "@/lib/audit";

const DIAS_HISTORIAL = 30;
const LIMITE_ITEMS = 30;

export async function GET() {
  const usuario = await getCurrentUser();
  const desde = new Date(Date.now() - DIAS_HISTORIAL * 24 * 60 * 60 * 1000);

  // No-ADMIN/SUPERVISOR solo ven notificaciones de su propia ubicación —
  // mismo criterio que canAccessUbicacion en dal.ts. Una regla configurada
  // como "Todas" no debe filtrar datos de otra sede a este rol.
  const filtroUbicacion =
    usuario.role === "ADMIN" || usuario.role === "SUPERVISOR"
      ? {}
      : { notificacion: { ubicacionId: usuario.ubicacionId ?? -1 } };

  const [items, noLeidas] = await Promise.all([
    prisma.notificacionDestinatario.findMany({
      where: { usuarioId: usuario.id, createdAt: { gte: desde }, ...filtroUbicacion },
      include: { notificacion: true },
      orderBy: { createdAt: "desc" },
      take: LIMITE_ITEMS,
    }),
    prisma.notificacionDestinatario.count({
      where: { usuarioId: usuario.id, leidoEn: null, ...filtroUbicacion },
    }),
  ]);

  return NextResponse.json({
    noLeidas,
    items: items.map((d) => ({
      id: d.id,
      tipo: d.notificacion.tipo,
      leidoEn: d.leidoEn,
      createdAt: d.notificacion.createdAt,
      resumen: resumenParaRol(
        d.notificacion.resumen as Record<string, unknown>,
        d.notificacion.tipo,
        usuario.role,
      ),
      ruta: rutaRegistro(d.notificacion.entidad, d.notificacion.entidadId),
    })),
  });
}
