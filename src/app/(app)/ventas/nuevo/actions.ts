"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth/dal";
import { crearVentaSchema } from "@/lib/validations/ventas";
import type { CatalogFormState } from "@/components/catalog-form";

export async function crearVenta(
  _state: CatalogFormState,
  formData: FormData,
): Promise<CatalogFormState> {
  const usuario = await requireRole(["ADMIN", "SUPERVISOR", "OPERADOR"]);

  const validated = crearVentaSchema.safeParse({
    clienteId: formData.get("clienteId"),
    loteId: formData.get("loteId"),
    pesoAsignadoKg: formData.get("pesoAsignadoKg"),
    precioUnitarioKg: formData.get("precioUnitarioKg"),
    operadorNombre: formData.get("operadorNombre"),
    placas: formData.get("placas"),
  });
  if (!validated.success) {
    return { errors: validated.error.flatten().fieldErrors };
  }

  const loteId = Number(validated.data.loteId);
  const lote = await prisma.lote.findUnique({
    where: { id: loteId },
    include: {
      compras: { select: { pesaje: { select: { netoKg: true } } } },
      movimientos: { select: { pesoAsignadoKg: true } },
    },
  });
  if (!lote || lote.estado !== "ABIERTO") {
    return { message: "El lote seleccionado ya no está disponible." };
  }

  const comprado = lote.compras.reduce(
    (sum, c) => sum + Number(c.pesaje.netoKg ?? 0),
    0,
  );
  const asignado = lote.movimientos.reduce(
    (sum, m) => sum + Number(m.pesoAsignadoKg),
    0,
  );
  const disponible = comprado - asignado;

  if (validated.data.pesoAsignadoKg > disponible) {
    return {
      errors: {
        pesoAsignadoKg: [`Solo hay ${disponible.toFixed(2)} kg disponibles en este lote.`],
      },
    };
  }

  const importeTotal = Number(
    (validated.data.precioUnitarioKg * validated.data.pesoAsignadoKg).toFixed(2),
  );

  const venta = await prisma.venta.create({
    data: {
      ubicacionId: lote.ubicacionId,
      articuloId: lote.articuloId,
      clienteId: Number(validated.data.clienteId),
      pesoVendidoKg: validated.data.pesoAsignadoKg,
      precioUnitarioKg: validated.data.precioUnitarioKg,
      importeTotal,
      operadorNombre: validated.data.operadorNombre || null,
      placas: validated.data.placas || null,
      createdByUsuarioId: usuario.id,
      movimientos: {
        create: {
          loteId: lote.id,
          pesoAsignadoKg: validated.data.pesoAsignadoKg,
          createdByUsuarioId: usuario.id,
        },
      },
    },
  });

  redirect(`/ventas/${venta.id}`);
}
