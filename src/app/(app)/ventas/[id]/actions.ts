"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireRole, canAccessUbicacion } from "@/lib/auth/dal";
import { saveUpload } from "@/lib/storage";
import { registrarAuditLog } from "@/lib/audit";
import { actualizarEstadoLote } from "@/lib/lote";
import { excedeTolerancia } from "@/lib/tolerancia";
import { obtenerUmbralTolerancia } from "@/lib/tolerancia-config";
import {
  reportarPesoVentaSchema,
  aprobarExcepcionSchema,
  corregirVentaSchema,
} from "@/lib/validations/ventas";
import type { Prisma } from "@/generated/prisma/client";
import { crearOrdenVenta } from "@/lib/netsuite";

export type VentaFormState =
  | { errors?: Record<string, string[]>; message?: string }
  | undefined;

export async function reportarPesoVenta(
  _state: VentaFormState,
  formData: FormData,
): Promise<VentaFormState> {
  const usuario = await requireRole(["ADMIN", "SUPERVISOR"]);

  const id = Number(formData.get("id"));
  const venta = await prisma.venta.findUnique({ where: { id } });
  if (!venta) return { message: "Venta no encontrada." };
  if (!canAccessUbicacion(usuario, venta.ubicacionId)) {
    return { message: "Venta no encontrada." };
  }
  if (venta.estado !== "BORRADOR") {
    return { message: "El peso de entrega de esta venta ya fue reportado." };
  }

  const validated = reportarPesoVentaSchema.safeParse({
    pesoReportadoClienteKg: formData.get("pesoReportadoClienteKg"),
    pesoReportadoEn: formData.get("pesoReportadoEn"),
    motivoDiferencia: formData.get("motivoDiferencia"),
  });
  if (!validated.success) {
    return { errors: validated.error.flatten().fieldErrors };
  }

  const { pesoReportadoClienteKg, motivoDiferencia } = validated.data;
  const pesoReportadoEn = new Date(`${validated.data.pesoReportadoEn}T00:00:00`);
  const diferenciaKg = Number(
    (Number(venta.pesoVendidoKg) - pesoReportadoClienteKg).toFixed(2),
  );

  if (diferenciaKg !== 0 && !motivoDiferencia) {
    return {
      errors: { motivoDiferencia: ["Indica el motivo de la diferencia."] },
    };
  }

  const foto = formData.get("comprobante");
  if (diferenciaKg !== 0 && (!(foto instanceof File) || foto.size === 0)) {
    return {
      errors: {
        comprobante: [
          "Debido a que se ha reportado diferencia, es necesario adjuntar evidencia.",
        ],
      },
    };
  }

  const umbral = await obtenerUmbralTolerancia(venta.articuloId);
  const excede = excedeTolerancia(Number(venta.pesoVendidoKg), pesoReportadoClienteKg, umbral);
  const importeTotal = Number(
    (Number(venta.precioUnitarioKg) * pesoReportadoClienteKg).toFixed(2),
  );

  const operaciones: Prisma.PrismaPromise<unknown>[] = [
    prisma.venta.update({
      where: { id },
      data: {
        pesoReportadoClienteKg,
        diferenciaKg,
        motivoDiferencia: motivoDiferencia || null,
        importeTotal,
        toleranciaExcedida: excede,
        estado: excede ? "PENDIENTE_APROBACION" : "CERRADA",
        reportadoPorClienteUsuarioId: usuario.id,
        pesoReportadoEn,
      },
    }),
  ];

  if (foto instanceof File && foto.size > 0) {
    const comprobanteGuardado = await saveUpload(foto, `evidencia/venta/${id}`);
    operaciones.push(
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
    );
  }

  await prisma.$transaction(operaciones);

  revalidatePath(`/ventas/${id}`);
  revalidatePath("/ventas");
  redirect(`/ventas/${id}`);
}

export async function corregirVenta(
  _state: VentaFormState,
  formData: FormData,
): Promise<VentaFormState> {
  const usuario = await requireRole(["ADMIN"]);

  const id = Number(formData.get("id"));
  const venta = await prisma.venta.findUnique({ where: { id } });
  if (!venta) return { message: "Venta no encontrada." };
  if (venta.estado === "CANCELADA") {
    return { message: "No se puede corregir una venta cancelada." };
  }

  const validated = corregirVentaSchema.safeParse({
    precioUnitarioKg: formData.get("precioUnitarioKg"),
    pesoReportadoClienteKg: formData.get("pesoReportadoClienteKg"),
    pesoReportadoEn: formData.get("pesoReportadoEn"),
    motivoDiferencia: formData.get("motivoDiferencia"),
    motivo: formData.get("motivo"),
  });
  if (!validated.success) {
    return { errors: validated.error.flatten().fieldErrors };
  }

  const detalleAnterior: Record<string, unknown> = {
    precioUnitarioKg: venta.precioUnitarioKg.toString(),
    diferenciaKg: venta.diferenciaKg.toString(),
    importeTotal: venta.importeTotal.toString(),
    estado: venta.estado,
  };

  const data: Prisma.VentaUpdateInput = { precioUnitarioKg: validated.data.precioUnitarioKg };

  if (venta.estado === "BORRADOR") {
    data.importeTotal = Number(
      (validated.data.precioUnitarioKg * Number(venta.pesoVendidoKg)).toFixed(2),
    );
  } else {
    const pesoReportadoClienteKg =
      validated.data.pesoReportadoClienteKg ?? Number(venta.pesoReportadoClienteKg);
    const diferenciaKg = Number(
      (Number(venta.pesoVendidoKg) - pesoReportadoClienteKg).toFixed(2),
    );

    if (diferenciaKg !== 0 && !validated.data.motivoDiferencia && !venta.motivoDiferencia) {
      return {
        errors: { motivoDiferencia: ["Indica el motivo de la diferencia."] },
      };
    }

    const umbral = await obtenerUmbralTolerancia(venta.articuloId);
    const excede = excedeTolerancia(Number(venta.pesoVendidoKg), pesoReportadoClienteKg, umbral);

    data.pesoReportadoClienteKg = pesoReportadoClienteKg;
    data.diferenciaKg = diferenciaKg;
    data.motivoDiferencia = validated.data.motivoDiferencia || venta.motivoDiferencia || null;
    data.toleranciaExcedida = excede;
    data.estado = excede ? "PENDIENTE_APROBACION" : "CERRADA";
    data.importeTotal = Number(
      (validated.data.precioUnitarioKg * pesoReportadoClienteKg).toFixed(2),
    );
    data.pesoReportadoEn = validated.data.pesoReportadoEn
      ? new Date(`${validated.data.pesoReportadoEn}T00:00:00`)
      : venta.pesoReportadoEn;
  }

  await prisma.venta.update({ where: { id }, data });

  await registrarAuditLog({
    entidad: "Venta",
    entidadId: id,
    accion: "VENTA_CORREGIDA",
    usuarioId: usuario.id,
    detalleAnterior,
    detalleNuevo: data as Record<string, unknown>,
    motivo: validated.data.motivo,
  });

  revalidatePath(`/ventas/${id}`);
  revalidatePath("/ventas");
  redirect(`/ventas/${id}`);
}

export async function eliminarVenta(formData: FormData) {
  const usuario = await requireRole(["ADMIN"]);

  const id = Number(formData.get("id"));
  const motivo = String(formData.get("motivo") ?? "").trim();
  if (!motivo) return;

  const venta = await prisma.venta.findUnique({
    where: { id },
    include: { movimientos: { select: { loteId: true } } },
  });
  if (!venta || venta.estado !== "BORRADOR") return;

  const loteIds = [...new Set(venta.movimientos.map((m) => m.loteId))];

  await prisma.$transaction([
    prisma.loteMovimiento.deleteMany({ where: { ventaId: id } }),
    prisma.venta.delete({ where: { id } }),
  ]);

  await Promise.all(loteIds.map((loteId) => actualizarEstadoLote(loteId)));

  await registrarAuditLog({
    entidad: "Venta",
    entidadId: id,
    accion: "VENTA_ELIMINADA",
    usuarioId: usuario.id,
    detalleAnterior: {
      clienteId: venta.clienteId,
      pesoVendidoKg: venta.pesoVendidoKg.toString(),
    },
    motivo,
  });

  revalidatePath("/ventas");
  redirect("/ventas");
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

export async function enviarVentaANetSuite(
  _state: VentaFormState,
  formData: FormData,
): Promise<VentaFormState> {
  const usuario = await requireRole(["ADMIN", "SUPERVISOR"]);

  const id = Number(formData.get("id"));
  const [venta, centroAprobacion] = await Promise.all([
    prisma.venta.findUnique({
      where: { id },
      include: { cliente: true, articulo: true, ubicacion: true },
    }),
    prisma.centroAprobacion.findFirst({ where: { predeterminado: true, activo: true } }),
  ]);
  if (!venta) return { message: "Venta no encontrada." };
  if (!canAccessUbicacion(usuario, venta.ubicacionId)) {
    return { message: "Venta no encontrada." };
  }
  if (venta.estado !== "CERRADA") {
    return { message: "Solo se pueden enviar a NetSuite ventas cerradas." };
  }
  if (venta.netsuiteOrderId) {
    return { message: "Esta venta ya fue enviada a NetSuite." };
  }
  if (!venta.cliente.netsuiteCustomerId) {
    return {
      message: `Falta configurar el ID de NetSuite del cliente "${venta.cliente.nombre}".`,
    };
  }
  if (!venta.articulo.netsuiteItemId) {
    return {
      message: `Falta configurar el ID de NetSuite del artículo "${venta.articulo.nombre}".`,
    };
  }
  if (!venta.ubicacion.netsuiteLocationId) {
    return {
      message: `Falta configurar el ID de NetSuite de la ubicación "${venta.ubicacion.nombre}".`,
    };
  }
  if (!usuario.netsuiteEmployeeId) {
    return {
      message: `Falta configurar tu ID de Employee en NetSuite (catálogo de Usuarios, "${usuario.nombre}").`,
    };
  }
  if (!centroAprobacion) {
    return {
      message: "Falta configurar un Centro de Aprobación predeterminado (catálogo de Centro de Aprobación).",
    };
  }

  let orden: { id: string; tranId: string | null };
  try {
    orden = await crearOrdenVenta({
      netsuiteCustomerId: venta.cliente.netsuiteCustomerId,
      netsuiteItemId: venta.articulo.netsuiteItemId,
      pesoKg: Number(venta.pesoReportadoClienteKg ?? 0),
      precioUnitarioKg: Number(venta.precioUnitarioKg),
      tranDate: (venta.pesoReportadoEn ?? venta.createdAt).toISOString().slice(0, 10),
      employeeId: usuario.netsuiteEmployeeId,
      locationId: venta.ubicacion.netsuiteLocationId,
      departmentId: centroAprobacion.netsuiteId,
    });
  } catch (error) {
    return {
      message: error instanceof Error ? error.message : "Error al enviar la venta a NetSuite.",
    };
  }

  await prisma.venta.update({
    where: { id },
    data: {
      netsuiteOrderId: orden.id,
      netsuiteOrderNumber: orden.tranId,
      netsuiteSyncedAt: new Date(),
    },
  });

  await registrarAuditLog({
    entidad: "Venta",
    entidadId: id,
    accion: "VENTA_ENVIADA_NETSUITE",
    usuarioId: usuario.id,
    detalleNuevo: { netsuiteOrderId: orden.id, netsuiteOrderNumber: orden.tranId },
  });

  revalidatePath(`/ventas/${id}`);
  redirect(`/ventas/${id}`);
}
