"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth/dal";
import { obtenerOCrearLoteDelDia } from "@/lib/lote";
import { crearCompraSchema } from "@/lib/validations/compras";
import type { CatalogFormState } from "@/components/catalog-form";

export async function crearCompra(
  _state: CatalogFormState,
  formData: FormData,
): Promise<CatalogFormState> {
  await requireRole(["ADMIN", "SUPERVISOR", "OPERADOR"]);

  const pesajeId = Number(formData.get("pesajeId"));
  const pesaje = await prisma.pesaje.findUnique({
    where: { id: pesajeId },
    include: { compra: true },
  });

  if (!pesaje) return { message: "Pesaje no encontrado." };
  if (pesaje.estado !== "COMPLETO") {
    return { message: "El pesaje debe estar completo (con neto capturado) para registrar la compra." };
  }
  if (pesaje.compra) {
    return { message: "Este pesaje ya tiene una compra registrada." };
  }

  const validated = crearCompraSchema.safeParse({
    precioUnitarioKg: formData.get("precioUnitarioKg"),
  });
  if (!validated.success) {
    return { errors: validated.error.flatten().fieldErrors };
  }

  const netoKg = Number(pesaje.netoKg);
  const importeTotal = Number((validated.data.precioUnitarioKg * netoKg).toFixed(2));

  const lote = await obtenerOCrearLoteDelDia(pesaje.ubicacionId, pesaje.articuloId);

  const compra = await prisma.compra.create({
    data: {
      pesajeId: pesaje.id,
      ubicacionId: pesaje.ubicacionId,
      proveedorId: pesaje.proveedorId,
      loteId: lote.id,
      precioUnitarioKg: validated.data.precioUnitarioKg,
      importeTotal,
    },
  });

  redirect(`/compras/${compra.id}`);
}
