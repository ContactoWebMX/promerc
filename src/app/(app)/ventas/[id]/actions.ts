"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth/dal";
import { saveUpload } from "@/lib/storage";
import { registrarAuditLog } from "@/lib/audit";
import { excedeTolerancia } from "@/lib/tolerancia";
import {
  reportarPesoVentaSchema,
  aprobarExcepcionSchema,
} from "@/lib/validations/ventas";

const UMBRAL_RESPALDO_PCT = 3;

async function obtenerUmbralTolerancia(articuloId: number) {
  const especifico = await prisma.toleranciaConfig.findFirst({
    where: { articuloId },
  });
  if (especifico) return Number(especifico.porcentajeUmbral);

  const global = await prisma.toleranciaConfig.findFirst({
    where: { articuloId: null },
  });
  return global ? Number(global.porcentajeUmbral) : UMBRAL_RESPALDO_PCT;
}

export type VentaFormState =
  | { errors?: Record<string, string[]>; message?: string }
  | undefined;

export async function reportarPesoVenta(
  _state: VentaFormState,
  formData: FormData,
): Promise<VentaFormState> {
  const usuario = await requireRole(["ADMIN", "SUPERVISOR", "OPERADOR"]);

  const id = Number(formData.get("id"));
  const venta = await prisma.venta.findUnique({ where: { id } });
  if (!venta) return { message: "Venta no encontrada." };
  if (venta.estado !== "BORRADOR") {
    return { message: "El peso de entrega de esta venta ya fue reportado." };
  }

  const validated = reportarPesoVentaSchema.safeParse({
    pesoReportadoClienteKg: formData.get("pesoReportadoClienteKg"),
    penalizacionKg: formData.get("penalizacionKg") || "0",
    penalizacionMotivo: formData.get("penalizacionMotivo"),
  });
  if (!validated.success) {
    return { errors: validated.error.flatten().fieldErrors };
  }

  const { pesoReportadoClienteKg, penalizacionKg, penalizacionMotivo } = validated.data;

  if (penalizacionKg > 0 && !penalizacionMotivo) {
    return {
      errors: { penalizacionMotivo: ["Indica el motivo de la penalización."] },
    };
  }

  const pesoFacturable = pesoReportadoClienteKg - penalizacionKg;
  if (pesoFacturable <= 0) {
    return {
      errors: { penalizacionKg: ["La penalización no puede ser mayor al peso reportado."] },
    };
  }

  const foto = formData.get("comprobante");
  if (!(foto instanceof File) || foto.size === 0) {
    return { errors: { comprobante: ["Sube la foto del comprobante de peso del cliente."] } };
  }

  const umbral = await obtenerUmbralTolerancia(venta.articuloId);
  const excede = excedeTolerancia(Number(venta.pesoVendidoKg), pesoFacturable, umbral);
  const importeTotal = Number((Number(venta.precioUnitarioKg) * pesoFacturable).toFixed(2));

  const comprobanteGuardado = await saveUpload(foto, `evidencia/venta/${id}`);

  await prisma.$transaction([
    prisma.venta.update({
      where: { id },
      data: {
        pesoReportadoClienteKg,
        penalizacionKg,
        penalizacionMotivo: penalizacionMotivo || null,
        importeTotal,
        toleranciaExcedida: excede,
        estado: excede ? "PENDIENTE_APROBACION" : "CERRADA",
        reportadoPorClienteUsuarioId: usuario.id,
      },
    }),
    prisma.evidencia.create({
      data: {
        ventaId: id,
        tipo: "COMPROBANTE_CLIENTE",
        rutaArchivo: comprobanteGuardado.rutaArchivo,
        mimeType: comprobanteGuardado.mimeType,
        tamanoBytes: comprobanteGuardado.tamanoBytes,
        subidoPorUsuarioId: usuario.id,
      },
    }),
  ]);

  revalidatePath(`/ventas/${id}`);
  revalidatePath("/ventas");
  redirect(`/ventas/${id}`);
}

export async function aprobarExcepcionTolerancia(
  _state: VentaFormState,
  formData: FormData,
): Promise<VentaFormState> {
  const usuario = await requireRole(["ADMIN", "SUPERVISOR"]);

  const id = Number(formData.get("id"));
  const venta = await prisma.venta.findUnique({ where: { id } });
  if (!venta) return { message: "Venta no encontrada." };
  if (venta.estado !== "PENDIENTE_APROBACION") {
    return { message: "Esta venta no tiene una excepción de tolerancia pendiente." };
  }

  const validated = aprobarExcepcionSchema.safeParse({
    justificacion: formData.get("justificacion"),
  });
  if (!validated.success) {
    return { errors: validated.error.flatten().fieldErrors };
  }

  await prisma.firma.create({
    data: {
      ventaId: id,
      tipo: "EXCEPCION_TOLERANCIA",
      nombreFirmante: usuario.nombre,
      justificacion: validated.data.justificacion,
      capturadaPorUsuarioId: usuario.id,
    },
  });

  await prisma.venta.update({ where: { id }, data: { estado: "CERRADA" } });

  await registrarAuditLog({
    entidad: "Venta",
    entidadId: id,
    accion: "TOLERANCIA_APROBADA",
    usuarioId: usuario.id,
    detalleAnterior: { estado: "PENDIENTE_APROBACION" },
    detalleNuevo: { estado: "CERRADA" },
    motivo: validated.data.justificacion,
  });

  revalidatePath(`/ventas/${id}`);
  revalidatePath("/ventas");
  redirect(`/ventas/${id}`);
}
