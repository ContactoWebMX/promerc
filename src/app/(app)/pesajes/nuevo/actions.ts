"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth/dal";
import { crearPesajeSchema } from "@/lib/validations/pesajes";
import type { CatalogFormState } from "@/components/catalog-form";

export async function crearPesaje(
  _state: CatalogFormState,
  formData: FormData,
): Promise<CatalogFormState> {
  const usuario = await requireRole(["ADMIN", "SUPERVISOR", "OPERADOR"]);

  const validated = crearPesajeSchema.safeParse({
    folioTicket: formData.get("folioTicket"),
    ubicacionId: formData.get("ubicacionId"),
    articuloId: formData.get("articuloId"),
    proveedorId: formData.get("proveedorId"),
    operadorNombre: formData.get("operadorNombre"),
    placas: formData.get("placas"),
    colorCamion: formData.get("colorCamion"),
    tipoCamion: formData.get("tipoCamion"),
    taraKg: formData.get("taraKg"),
  });
  if (!validated.success) {
    return { errors: validated.error.flatten().fieldErrors };
  }

  const { operadorNombre, placas } = validated.data;

  const transportista = await prisma.transportista.upsert({
    where: { nombre_placas: { nombre: operadorNombre, placas } },
    update: {},
    create: { nombre: operadorNombre, placas },
  });

  const pesaje = await prisma.pesaje.create({
    data: {
      folioTicket: validated.data.folioTicket,
      ubicacionId: Number(validated.data.ubicacionId),
      articuloId: Number(validated.data.articuloId),
      proveedorId: Number(validated.data.proveedorId),
      transportistaId: transportista.id,
      operadorNombre,
      placas,
      colorCamion: validated.data.colorCamion || null,
      tipoCamion: validated.data.tipoCamion || null,
      taraKg: validated.data.taraKg,
      taraCapturadaEn: new Date(),
      createdByUsuarioId: usuario.id,
    },
  });

  redirect(`/pesajes/${pesaje.id}`);
}
