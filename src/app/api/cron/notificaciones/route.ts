import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { armarCorreoNotificacion } from "@/lib/notificaciones-email";
import { enviarCorreo } from "@/lib/email";

const LIMITE_INTENTOS = 5;
const TAMANO_LOTE = 50;

export async function POST(request: Request) {
  const secret = request.headers.get("x-cron-secret");
  if (!secret || !process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const pendientes = await prisma.notificacionDestinatario.findMany({
    where: {
      requiereCorreo: true,
      correoEnviadoEn: null,
      correoIntentos: { lt: LIMITE_INTENTOS },
      usuario: { activo: true },
    },
    include: { notificacion: true, usuario: true },
    orderBy: { createdAt: "asc" },
    take: TAMANO_LOTE,
  });

  // Reclama el lote de inmediato incrementando intentos para todos a la vez
  // — si el envío de estos 50 tarda más que el intervalo del cron, una
  // corrida concurrente ya no los vuelve a seleccionar (su propio filtro
  // correoIntentos < LIMITE_INTENTOS los excluye), evitando correos
  // duplicados. El catch de abajo sigue incrementando por su cuenta para
  // llevar el conteo de fallos reales; esto solo resta un intento del techo
  // de 5 por adelantado, tradeoff aceptable.
  if (pendientes.length > 0) {
    await prisma.notificacionDestinatario.updateMany({
      where: { id: { in: pendientes.map((p) => p.id) } },
      data: { correoIntentos: { increment: 1 } },
    });
  }

  let enviados = 0;
  let fallidos = 0;

  for (const item of pendientes) {
    // No-ADMIN/SUPERVISOR solo reciben correo de notificaciones de su
    // propia ubicación — mismo criterio que canAccessUbicacion en dal.ts,
    // aplicado aquí en memoria porque ya tenemos ambas filas cargadas.
    if (
      item.usuario.role !== "ADMIN" &&
      item.usuario.role !== "SUPERVISOR" &&
      item.notificacion.ubicacionId !== item.usuario.ubicacionId
    ) {
      continue;
    }
    try {
      const correo = await armarCorreoNotificacion(
        item.notificacion.tipo,
        item.notificacion.entidad,
        item.notificacion.entidadId,
        item.notificacion.resumen as Record<string, unknown>,
        item.usuario.role,
      );
      await enviarCorreo({ to: item.usuario.email, ...correo });
      await prisma.notificacionDestinatario.update({
        where: { id: item.id },
        data: { correoEnviadoEn: new Date() },
      });
      enviados++;
    } catch (error) {
      await prisma.notificacionDestinatario.update({
        where: { id: item.id },
        data: {
          correoIntentos: { increment: 1 },
          correoError: error instanceof Error ? error.message : String(error),
        },
      });
      fallidos++;
    }
  }

  return NextResponse.json({ revisados: pendientes.length, enviados, fallidos });
}
