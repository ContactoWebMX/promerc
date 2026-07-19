"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth/dal";
import { saveUpload, saveDataUrl } from "@/lib/storage";
import { cerrarPesajeSchema, anularPesajeSchema } from "@/lib/validations/pesajes";
import { leerTicketBascula, type TicketExtraido } from "@/lib/ocr";

export type CerrarPesajeState =
  | { errors?: Record<string, string[]>; message?: string }
  | undefined;

export async function leerTicketConIA(
  formData: FormData,
): Promise<{ datos?: TicketExtraido; error?: string }> {
  await requireRole(["ADMIN", "SUPERVISOR", "OPERADOR"]);

  const foto = formData.get("foto");
  if (!(foto instanceof File) || foto.size === 0) {
    return { error: "No se recibió ninguna foto." };
  }

  try {
    const buffer = Buffer.from(await foto.arrayBuffer());
    const datos = await leerTicketBascula(buffer, foto.type);
    return { datos };
  } catch {
    return { error: "No se pudo leer el ticket automáticamente. Llena los campos manualmente." };
  }
}

export async function cerrarPesaje(
  _state: CerrarPesajeState,
  formData: FormData,
): Promise<CerrarPesajeState> {
  const usuario = await requireRole(["ADMIN", "SUPERVISOR", "OPERADOR"]);

  const id = Number(formData.get("id"));
  const pesaje = await prisma.pesaje.findUnique({ where: { id } });
  if (!pesaje) {
    return { message: "Pesaje no encontrado." };
  }
  if (pesaje.estado !== "TARA_CAPTURADA") {
    return { message: "Este pesaje ya fue cerrado o anulado." };
  }

  const validated = cerrarPesajeSchema.safeParse({
    grossKg: formData.get("grossKg"),
    pesadorNombre: formData.get("pesadorNombre"),
    observaciones: formData.get("observaciones"),
    clienteDestinoReferencia: formData.get("clienteDestinoReferencia"),
    firmaSalidaNombre: formData.get("firmaSalidaNombre"),
    firmaSupervisorNombre: formData.get("firmaSupervisorNombre"),
  });
  if (!validated.success) {
    return { errors: validated.error.flatten().fieldErrors };
  }

  const netoKg = validated.data.grossKg - Number(pesaje.taraKg);
  if (netoKg <= 0) {
    return {
      errors: { grossKg: ["El peso cargado debe ser mayor a la tara."] },
    };
  }

  const foto = formData.get("foto");
  if (!(foto instanceof File) || foto.size === 0) {
    return { errors: { foto: ["Sube la foto del ticket de báscula."] } };
  }

  const firmaSalidaImagen = String(formData.get("firmaSalidaImagen") ?? "");
  if (!firmaSalidaImagen) {
    return { errors: { firmaSalidaImagen: ["Falta la firma de salida."] } };
  }
  const firmaSupervisorImagen = String(
    formData.get("firmaSupervisorImagen") ?? "",
  );
  if (!firmaSupervisorImagen) {
    return {
      errors: { firmaSupervisorImagen: ["Falta la firma del supervisor."] },
    };
  }

  const unidades = await prisma.unidadEmpaque.findMany({
    where: { activo: true },
  });
  const pacas = unidades
    .map((u) => ({
      unidadEmpaqueId: u.id,
      cantidad: Number(formData.get(`paca-${u.id}`) ?? 0),
    }))
    .filter((p) => p.cantidad > 0);

  const fotoGuardada = await saveUpload(foto, `evidencia/pesaje/${id}`);
  const firmaSalidaGuardada = await saveDataUrl(
    firmaSalidaImagen,
    `firmas/salida_proveedor`,
  );
  const firmaSupervisorGuardada = await saveDataUrl(
    firmaSupervisorImagen,
    `firmas/validacion_supervisor`,
  );

  await prisma.$transaction([
    prisma.pesaje.update({
      where: { id },
      data: {
        grossKg: validated.data.grossKg,
        netoKg,
        netoCapturadoEn: new Date(),
        pesadorNombre: validated.data.pesadorNombre,
        observaciones: validated.data.observaciones || null,
        clienteDestinoReferencia: validated.data.clienteDestinoReferencia || null,
        estado: "COMPLETO",
      },
    }),
    ...pacas.map((p) =>
      prisma.pesajeEmpaque.upsert({
        where: {
          pesajeId_unidadEmpaqueId: {
            pesajeId: id,
            unidadEmpaqueId: p.unidadEmpaqueId,
          },
        },
        update: { cantidad: p.cantidad },
        create: {
          pesajeId: id,
          unidadEmpaqueId: p.unidadEmpaqueId,
          cantidad: p.cantidad,
        },
      }),
    ),
    prisma.evidencia.create({
      data: {
        pesajeId: id,
        tipo: "TICKET_BASCULA",
        rutaArchivo: fotoGuardada.rutaArchivo,
        mimeType: fotoGuardada.mimeType,
        tamanoBytes: fotoGuardada.tamanoBytes,
        subidoPorUsuarioId: usuario.id,
      },
    }),
    prisma.firma.create({
      data: {
        pesajeId: id,
        tipo: "SALIDA_PROVEEDOR",
        nombreFirmante: validated.data.firmaSalidaNombre,
        imagenFirma: firmaSalidaGuardada.rutaArchivo,
        capturadaPorUsuarioId: usuario.id,
      },
    }),
    prisma.firma.create({
      data: {
        pesajeId: id,
        tipo: "VALIDACION_SUPERVISOR",
        nombreFirmante: validated.data.firmaSupervisorNombre,
        imagenFirma: firmaSupervisorGuardada.rutaArchivo,
        capturadaPorUsuarioId: usuario.id,
      },
    }),
  ]);

  revalidatePath(`/pesajes/${id}`);
  revalidatePath("/pesajes");
  redirect(`/pesajes/${id}`);
}

export async function anularPesaje(formData: FormData) {
  await requireRole(["ADMIN", "SUPERVISOR", "OPERADOR"]);

  const id = Number(formData.get("id"));
  const validated = anularPesajeSchema.safeParse({
    motivoAnulacion: formData.get("motivoAnulacion"),
  });
  if (!validated.success) return;

  const pesaje = await prisma.pesaje.findUnique({ where: { id } });
  if (!pesaje || pesaje.estado !== "TARA_CAPTURADA") return;

  await prisma.pesaje.update({
    where: { id },
    data: { estado: "ANULADO", motivoAnulacion: validated.data.motivoAnulacion },
  });

  revalidatePath(`/pesajes/${id}`);
  revalidatePath("/pesajes");
}
