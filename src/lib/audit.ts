import "server-only";
import { prisma } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";

export async function registrarAuditLog(data: {
  entidad: string;
  entidadId: number;
  accion: string;
  usuarioId: number;
  detalleAnterior?: Record<string, unknown>;
  detalleNuevo?: Record<string, unknown>;
  motivo?: string;
}) {
  await prisma.auditLog.create({
    data: {
      entidad: data.entidad,
      entidadId: data.entidadId,
      accion: data.accion,
      usuarioId: data.usuarioId,
      detalleAnterior: data.detalleAnterior as Prisma.InputJsonValue | undefined,
      detalleNuevo: data.detalleNuevo as Prisma.InputJsonValue | undefined,
      motivo: data.motivo,
    },
  });
}
