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

// Labels legibles para el visor de auditoría (src/app/(app)/auditoria) y su
// export a Excel. Si se agrega una acción nueva a algún registrarAuditLog()
// y no está aquí, el visor cae al valor crudo de `accion` como fallback —
// no oculta la fila.
export const ACCIONES_AUDITORIA: Record<string, string> = {
  FOLIO_CORREGIDO: "Folio corregido",
  VENTA_CORREGIDA: "Venta corregida",
  VENTA_ELIMINADA: "Venta eliminada",
  TOLERANCIA_APROBADA: "Tolerancia aprobada",
  VENTA_ENVIADA_NETSUITE: "Venta enviada a NetSuite",
  COMPRA_CORREGIDA: "Compra corregida",
  COMPRA_ELIMINADA: "Compra eliminada",
  COMPRA_ANULADA: "Compra anulada",
  COMPRA_ENVIADA_NETSUITE: "Compra enviada a NetSuite",
  PESAJE_CORREGIDO: "Pesaje corregido",
  PESAJE_ELIMINADO: "Pesaje eliminado",
};

// Acciones que borran el registro de la base (prisma.<entidad>.delete(),
// no un cambio de estado) — para estas no se debe ofrecer un link "Ver
// registro" en el visor, el entidadId ya no existe.
export const ACCIONES_SIN_REGISTRO = new Set([
  "VENTA_ELIMINADA",
  "COMPRA_ELIMINADA",
  "PESAJE_ELIMINADO",
]);

const RUTA_POR_ENTIDAD: Record<string, string> = {
  Lote: "/lotes",
  Venta: "/ventas",
  Compra: "/compras",
  Pesaje: "/pesajes",
};

export function rutaRegistro(entidad: string, entidadId: number): string | null {
  const base = RUTA_POR_ENTIDAD[entidad];
  return base ? `${base}/${entidadId}` : null;
}
