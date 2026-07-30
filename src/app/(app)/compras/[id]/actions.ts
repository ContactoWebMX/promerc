"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth/dal";
import { registrarAuditLog } from "@/lib/audit";
import { actualizarEstadoLote } from "@/lib/lote";
import { corregirCompraSchema, anularCompraSchema } from "@/lib/validations/compras";
import type { CatalogFormState } from "@/components/catalog-form";
import { crearOrdenCompra } from "@/lib/netsuite";

export async function corregirCompra(
  _state: CatalogFormState,
  formData: FormData,
): Promise<CatalogFormState> {
  const usuario = await requireRole(["ADMIN"]);

  const id = Number(formData.get("id"));
  const compra = await prisma.compra.findUnique({ where: { id }, include: { pesaje: true } });
  if (!compra) return { message: "Compra no encontrada." };
  if (compra.estado === "CANCELADA") {
    return { message: "No se puede corregir una compra cancelada." };
  }

  const validated = corregirCompraSchema.safeParse({
    precioUnitarioKg: formData.get("precioUnitarioKg"),
    motivo: formData.get("motivo"),
  });
  if (!validated.success) {
    return { errors: validated.error.flatten().fieldErrors };
  }

  const netoKg = Number(compra.pesaje.netoKg ?? 0);
  const importeTotal = Number((validated.data.precioUnitarioKg * netoKg).toFixed(2));

  await prisma.compra.update({
    where: { id },
    data: { precioUnitarioKg: validated.data.precioUnitarioKg, importeTotal },
  });

  await registrarAuditLog({
    entidad: "Compra",
    entidadId: id,
    accion: "COMPRA_CORREGIDA",
    usuarioId: usuario.id,
    detalleAnterior: {
      precioUnitarioKg: compra.precioUnitarioKg.toString(),
      importeTotal: compra.importeTotal.toString(),
    },
    detalleNuevo: { precioUnitarioKg: validated.data.precioUnitarioKg, importeTotal },
    motivo: validated.data.motivo,
  });

  revalidatePath(`/compras/${id}`);
  revalidatePath("/compras");
  redirect(`/compras/${id}`);
}

export async function eliminarCompra(formData: FormData) {
  const usuario = await requireRole(["ADMIN"]);

  const id = Number(formData.get("id"));
  const motivo = String(formData.get("motivo") ?? "").trim();
  if (!motivo) return;

  const compra = await prisma.compra.findUnique({
    where: { id },
    include: { lote: { include: { movimientos: true } } },
  });
  if (!compra || compra.estado === "CANCELADA") return;

  const asignado =
    compra.lote?.movimientos.reduce((s, m) => s + Number(m.pesoAsignadoKg), 0) ?? 0;
  if (asignado > 0) return; // el lote ya tiene ventas consumiéndolo — no se puede eliminar

  await prisma.compra.delete({ where: { id } });

  await registrarAuditLog({
    entidad: "Compra",
    entidadId: id,
    accion: "COMPRA_ELIMINADA",
    usuarioId: usuario.id,
    detalleAnterior: {
      precioUnitarioKg: compra.precioUnitarioKg.toString(),
      pesajeId: compra.pesajeId,
    },
    motivo,
  });

  revalidatePath("/compras");
  redirect("/compras");
}

// A diferencia de eliminar (borra el registro), anular conserva la compra
// con su motivo en la bitácora — mismo criterio que anularPesaje. Solo
// aplica mientras nada se haya vendido de ese lote todavía.
export async function anularCompra(
  _state: CatalogFormState,
  formData: FormData,
): Promise<CatalogFormState> {
  const usuario = await requireRole(["ADMIN"]);

  const id = Number(formData.get("id"));
  const compra = await prisma.compra.findUnique({
    where: { id },
    include: { lote: { include: { movimientos: true } } },
  });
  if (!compra) return { message: "Compra no encontrada." };
  if (compra.estado !== "ABIERTA") {
    return { message: "Esta compra ya no está abierta." };
  }

  const asignado =
    compra.lote?.movimientos.reduce((s, m) => s + Number(m.pesoAsignadoKg), 0) ?? 0;
  if (asignado > 0) {
    return { message: "No se puede anular: su lote ya tiene ventas que consumen este material." };
  }

  const validated = anularCompraSchema.safeParse({ motivo: formData.get("motivo") });
  if (!validated.success) {
    return { errors: validated.error.flatten().fieldErrors };
  }

  await prisma.compra.update({ where: { id }, data: { estado: "CANCELADA" } });
  if (compra.loteId) await actualizarEstadoLote(compra.loteId);

  await registrarAuditLog({
    entidad: "Compra",
    entidadId: id,
    accion: "COMPRA_ANULADA",
    usuarioId: usuario.id,
    detalleAnterior: { estado: "ABIERTA" },
    detalleNuevo: { estado: "CANCELADA" },
    motivo: validated.data.motivo,
  });

  revalidatePath(`/compras/${id}`);
  revalidatePath("/compras");
  redirect(`/compras/${id}`);
}

export async function enviarCompraANetSuite(
  _state: CatalogFormState,
  formData: FormData,
): Promise<CatalogFormState> {
  const usuario = await requireRole(["ADMIN", "SUPERVISOR"]);

  const id = Number(formData.get("id"));
  const compra = await prisma.compra.findUnique({
    where: { id },
    include: { proveedor: true, pesaje: { include: { articulo: true } } },
  });
  if (!compra) return { message: "Compra no encontrada." };
  if (compra.estado === "CANCELADA") {
    return { message: "No se puede enviar a NetSuite una compra cancelada." };
  }
  if (compra.netsuiteOrderId) {
    return { message: "Esta compra ya fue enviada a NetSuite." };
  }
  if (!compra.proveedor.netsuiteVendorId) {
    return {
      message: `Falta configurar el ID de NetSuite del proveedor "${compra.proveedor.nombre}".`,
    };
  }
  if (!compra.pesaje.articulo?.netsuiteItemId) {
    return {
      message: `Falta configurar el ID de NetSuite del artículo "${compra.pesaje.articulo?.nombre ?? ""}".`,
    };
  }

  let orden: { id: string; tranId: string | null };
  try {
    orden = await crearOrdenCompra({
      netsuiteVendorId: compra.proveedor.netsuiteVendorId,
      netsuiteItemId: compra.pesaje.articulo.netsuiteItemId,
      netoKg: Number(compra.pesaje.netoKg ?? 0),
      precioUnitarioKg: Number(compra.precioUnitarioKg),
      tranDate: compra.createdAt.toISOString().slice(0, 10),
    });
  } catch (error) {
    return {
      message: error instanceof Error ? error.message : "Error al enviar la compra a NetSuite.",
    };
  }

  await prisma.compra.update({
    where: { id },
    data: {
      netsuiteOrderId: orden.id,
      netsuiteOrderNumber: orden.tranId,
      netsuiteSyncedAt: new Date(),
    },
  });

  await registrarAuditLog({
    entidad: "Compra",
    entidadId: id,
    accion: "COMPRA_ENVIADA_NETSUITE",
    usuarioId: usuario.id,
    detalleNuevo: { netsuiteOrderId: orden.id, netsuiteOrderNumber: orden.tranId },
  });

  revalidatePath(`/compras/${id}`);
  redirect(`/compras/${id}`);
}
