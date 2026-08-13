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
    },
    include: { notificacion: true, usuario: true },
    orderBy: { createdAt: "asc" },
    take: TAMANO_LOTE,
  });

  let enviados = 0;
  let fallidos = 0;

  for (const item of pendientes) {
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
