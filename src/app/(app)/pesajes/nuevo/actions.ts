"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireRole, canAccessUbicacion } from "@/lib/auth/dal";
import { saveUpload } from "@/lib/storage";
import { crearPesajeSchema } from "@/lib/validations/pesajes";
import { combinarFechaHoraTicket } from "@/lib/ocr";
import type { CatalogFormState } from "@/components/catalog-form";

export async function crearPesaje(
  _state: CatalogFormState,
  formData: FormData,
): Promise<CatalogFormState> {
  const usuario = await requireRole(["ADMIN", "SUPERVISOR", "OPERADOR"]);

  const validated = crearPesajeSchema.safeParse({
    folioTicket: formData.get("folioTicket"),
    idOperacionBascula: formData.get("idOperacionBascula"),
    fechaTicket: formData.get("fechaTicket"),
    horaTicket: formData.get("horaTicket"),
    ubicacionId: formData.get("ubicacionId"),
    proveedorId: formData.get("proveedorId"),
    operadorNombre: formData.get("operadorNombre"),
    placas: formData.get("placas"),
    taraKg: formData.get("taraKg"),
  });
  if (!validated.success) {
    return { errors: validated.error.flatten().fieldErrors };
  }

  if (!canAccessUbicacion(usuario, Number(validated.data.ubicacionId))) {
    return { errors: { ubicacionId: ["No tienes acceso a esa ubicación."] } };
  }

  const foto = formData.get("foto");
  if (!(foto instanceof File) || foto.size === 0) {
    return { errors: { foto: ["Sube la foto del ticket de báscula."] } };
  }

  const { operadorNombre, placas } = validated.data;

  const transportista = await prisma.transportista.upsert({
    where: { nombre_placas: { nombre: operadorNombre, placas } },
    update: {},
    create: { nombre: operadorNombre, placas },
  });

  const taraCapturadaEn =
    combinarFechaHoraTicket(validated.data.fechaTicket, validated.data.horaTicket) ??
    new Date();

  const pesaje = await prisma.pesaje.create({
    data: {
      folioTicket: validated.data.folioTicket,
      idOperacionBascula: validated.data.idOperacionBascula || null,
      ubicacionId: Number(validated.data.ubicacionId),
      proveedorId: Number(validated.data.proveedorId),
      transportistaId: transportista.id,
      operadorNombre,
      placas,
      taraKg: validated.data.taraKg,
      taraCapturadaEn,
      createdByUsuarioId: usuario.id,
    },
  });

  const fotoGuardada = await saveUpload(foto, `evidencia/pesaje/${pesaje.id}`);
  await prisma.evidencia.create({
    data: {
      pesajeId: pesaje.id,
      tipo: "TICKET_TARA",
      rutaArchivo: fotoGuardada.rutaArchivo,
      mimeType: fotoGuardada.mimeType,
      tamanoBytes: fotoGuardada.tamanoBytes,
      subidoPorUsuarioId: usuario.id,
    },
  });

  redirect(`/pesajes/${pesaje.id}`);
}
