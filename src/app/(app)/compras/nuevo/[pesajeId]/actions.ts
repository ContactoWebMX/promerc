"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireRole, canAccessUbicacion } from "@/lib/auth/dal";
import { actualizarEstadoLote } from "@/lib/lote";
import { crearCompraSchema } from "@/lib/validations/compras";
import type { CatalogFormState } from "@/components/catalog-form";

export async function crearCompra(
  _state: CatalogFormState,
  formData: FormData,
): Promise<CatalogFormState> {
  const usuario = await requireRole(["ADMIN", "SUPERVISOR", "OPERADOR"]);

  const pesajeId = Number(formData.get("pesajeId"));
  const pesaje = await prisma.pesaje.findUnique({
    where: { id: pesajeId },
    include: { compra: true },
  });

  if (!pesaje) return { message: "Pesaje no encontrado." };
  if (!canAccessUbicacion(usuario, pesaje.ubicacionId)) {
    return { message: "Pesaje no encontrado." };
  }
  if (pesaje.estado !== "COMPLETO") {
    return { message: "El pesaje debe estar completo (con neto capturado) para registrar la compra." };
  }
  if (pesaje.compra) {
    return { message: "Este pesaje ya tiene una compra registrada." };
  }
  if (!pesaje.articuloId || !pesaje.loteId) {
    return { message: "Falta el artículo o el lote de este pesaje." };
  }

  const validated = crearCompraSchema.safeParse({
    precioUnitarioKg: formData.get("precioUnitarioKg"),
  });
  if (!validated.success) {
    return { errors: validated.error.flatten().fieldErrors };
  }

  const netoKg = Number(pesaje.netoKg);
  const importeTotal = Number((validated.data.precioUnitarioKg * netoKg).toFixed(2));

  const compra = await prisma.compra.create({
    data: {
      pesajeId: pesaje.id,
      ubicacionId: pesaje.ubicacionId,
      proveedorId: pesaje.proveedorId,
      loteId: pesaje.loteId,
      precioUnitarioKg: validated.data.precioUnitarioKg,
      importeTotal,
      // Se hereda de la fecha del ticket capturada al registrar el pesaje
      // (taraCapturadaEn) — no se vuelve a pedir aquí.
      fechaOperacion: pesaje.taraCapturadaEn,
    },
  });

  await actualizarEstadoLote(pesaje.loteId);

  redirect(`/compras/${compra.id}`);
}
