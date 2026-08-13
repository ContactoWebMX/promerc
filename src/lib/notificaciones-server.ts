import "server-only";
import { prisma } from "@/lib/db";
import { resolverDestinatarios } from "@/lib/notificaciones";
import type { TipoNotificacion } from "@/generated/prisma/enums";
import type { Prisma } from "@/generated/prisma/client";

// La operación principal (cerrar el pesaje, registrar la compra, cerrar la
// venta) ya tuvo éxito antes de llegar aquí — un fallo al notificar es
// recuperable (se puede reconstruir manualmente si hace falta) mientras que
// revertir una operación exitosa por un fallo de notificación sí sería un
// problema real. Por eso todo el cuerpo va envuelto en un try/catch que
// solo loguea.
export async function crearNotificacion(data: {
  tipo: TipoNotificacion;
  entidad: string;
  entidadId: number;
  ubicacionId: number;
  resumen: Record<string, unknown>;
}): Promise<void> {
  try {
    const reglas = await prisma.reglaNotificacion.findMany({
      where: {
        tipo: data.tipo,
        activo: true,
        OR: [{ ubicacionId: null }, { ubicacionId: data.ubicacionId }],
      },
      select: { usuarioId: true, canalInApp: true, canalCorreo: true },
    });

    // La fila Notificacion se crea siempre, aunque nadie esté suscrito
    // todavía — queda como historial; si luego se agrega una regla, no
    // genera notificaciones retroactivas (ver spec, sección "Resolución de
    // destinatarios").
    const notificacion = await prisma.notificacion.create({
      data: {
        tipo: data.tipo,
        entidad: data.entidad,
        entidadId: data.entidadId,
        ubicacionId: data.ubicacionId,
        resumen: data.resumen as Prisma.InputJsonValue,
      },
    });

    const porUsuario = resolverDestinatarios(reglas);
    const destinatarios = [...porUsuario.entries()].filter(
      ([, canales]) => canales.inApp || canales.correo,
    );
    if (destinatarios.length === 0) return;

    await prisma.notificacionDestinatario.createMany({
      data: destinatarios.map(([usuarioId, canales]) => ({
        notificacionId: notificacion.id,
        usuarioId,
        requiereCorreo: canales.correo,
      })),
    });
  } catch (error) {
    console.error(`[notificaciones] no se pudo crear notificación ${data.tipo}:`, error);
  }
}
