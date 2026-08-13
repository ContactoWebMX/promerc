"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireRole, canAccessUbicacion } from "@/lib/auth/dal";
import { saveUpload, saveDataUrl } from "@/lib/storage";
import { registrarAuditLog } from "@/lib/audit";
import { crearLoteParaCompra } from "@/lib/lote";
import {
  registrarSalidaSchema,
  cerrarPesajeSchema,
  anularPesajeSchema,
  corregirPesajeSchema,
} from "@/lib/validations/pesajes";
import { leerTicketBascula, combinarFechaHoraTicket, OcrError, type TicketExtraido } from "@/lib/ocr";
import type { Prisma } from "@/generated/prisma/client";
import type { CatalogFormState } from "@/components/catalog-form";

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
  } catch (err) {
    if (err instanceof OcrError) return { error: err.message };
    return { error: "No se pudo leer el ticket automáticamente. Llena los campos manualmente." };
  }
}

// Paso 1 — al cargar el camión, antes de báscula: artículo, pacas, destino
// y la firma de quien autoriza la salida. Todavía no se conoce el peso.
export async function registrarSalida(
  _state: CerrarPesajeState,
  formData: FormData,
): Promise<CerrarPesajeState> {
  const usuario = await requireRole(["ADMIN", "SUPERVISOR", "OPERADOR"]);

  const id = Number(formData.get("id"));
  const pesaje = await prisma.pesaje.findUnique({ where: { id } });
  if (!pesaje) {
    return { message: "Pesaje no encontrado." };
  }
  if (!canAccessUbicacion(usuario, pesaje.ubicacionId)) {
    return { message: "Pesaje no encontrado." };
  }
  if (pesaje.estado !== "TARA_CAPTURADA") {
    return { message: "La salida de este pesaje ya fue registrada." };
  }

  const validated = registrarSalidaSchema.safeParse({
    articuloId: formData.get("articuloId"),
    clienteDestinoReferencia: formData.get("clienteDestinoReferencia"),
    firmaSalidaNombre: formData.get("firmaSalidaNombre"),
  });
  if (!validated.success) {
    return { errors: validated.error.flatten().fieldErrors };
  }

  const firmaSalidaImagen = String(formData.get("firmaSalidaImagen") ?? "");
  if (!firmaSalidaImagen) {
    return { errors: { firmaSalidaImagen: ["Falta la firma de quien autoriza la salida."] } };
  }

  const unidades = await prisma.unidadEmpaque.findMany({ where: { activo: true } });
  const pacas = unidades
    .map((u) => ({
      unidadEmpaqueId: u.id,
      cantidad: Number(formData.get(`paca-${u.id}`) ?? 0),
    }))
    .filter((p) => p.cantidad > 0);

  const firmaSalidaGuardada = await saveDataUrl(firmaSalidaImagen, `firmas/salida_proveedor`);
  if (!firmaSalidaGuardada) {
    return { errors: { firmaSalidaImagen: ["La firma no es una imagen válida."] } };
  }

  await prisma.$transaction([
    prisma.pesaje.update({
      where: { id },
      data: {
        articuloId: Number(validated.data.articuloId),
        clienteDestinoReferencia: validated.data.clienteDestinoReferencia || null,
        estado: "CARGA_REGISTRADA",
      },
    }),
    ...pacas.map((p) =>
      prisma.pesajeEmpaque.upsert({
        where: {
          pesajeId_unidadEmpaqueId: { pesajeId: id, unidadEmpaqueId: p.unidadEmpaqueId },
        },
        update: { cantidad: p.cantidad },
        create: { pesajeId: id, unidadEmpaqueId: p.unidadEmpaqueId, cantidad: p.cantidad },
      }),
    ),
    prisma.firma.create({
      data: {
        pesajeId: id,
        tipo: "SALIDA_PROVEEDOR",
        nombreFirmante: validated.data.firmaSalidaNombre,
        imagenFirma: firmaSalidaGuardada.rutaArchivo,
        capturadaPorUsuarioId: usuario.id,
      },
    }),
  ]);

  revalidatePath(`/pesajes/${id}`);
  revalidatePath("/pesajes");
  redirect(`/pesajes/${id}`);
}

// Paso 2 — al pasar por báscula: se concilia el ticket con el peso real y se
// cierra el pesaje. Aquí nace el lote de ese artículo (no hasta que alguien
// registre la compra) para que el material exista en trazabilidad/inventario
// apenas se conoce el peso real, sin esperar a que se capture el precio.
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
  if (!canAccessUbicacion(usuario, pesaje.ubicacionId)) {
    return { message: "Pesaje no encontrado." };
  }
  if (pesaje.estado !== "CARGA_REGISTRADA") {
    return { message: "Falta registrar la salida (artículo, pacas y firma) antes de cerrar en báscula." };
  }
  if (!pesaje.articuloId) {
    return { message: "Falta el artículo de este pesaje." };
  }

  const validated = cerrarPesajeSchema.safeParse({
    grossKg: formData.get("grossKg"),
    pesadorNombre: formData.get("pesadorNombre"),
    observaciones: formData.get("observaciones"),
    fechaTicket: formData.get("fechaTicket"),
    horaTicket: formData.get("horaTicket"),
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

  const fotoGuardada = await saveUpload(foto, `evidencia/pesaje/${id}`);
  if (!fotoGuardada) {
    return { errors: { foto: ["El archivo no es una imagen válida (jpg, png o webp)."] } };
  }
  const netoCapturadoEn =
    combinarFechaHoraTicket(validated.data.fechaTicket, validated.data.horaTicket) ??
    new Date();

  const lote = await crearLoteParaCompra(pesaje.ubicacionId, pesaje.articuloId);

  await prisma.$transaction([
    prisma.pesaje.update({
      where: { id },
      data: {
        grossKg: validated.data.grossKg,
        netoKg,
        netoCapturadoEn,
        pesadorNombre: validated.data.pesadorNombre,
        observaciones: validated.data.observaciones || null,
        estado: "COMPLETO",
        loteId: lote.id,
      },
    }),
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
  ]);

  revalidatePath(`/pesajes/${id}`);
  revalidatePath("/pesajes");
  redirect(`/pesajes/${id}`);
}

export async function anularPesaje(formData: FormData) {
  const usuario = await requireRole(["ADMIN", "SUPERVISOR", "OPERADOR"]);

  const id = Number(formData.get("id"));
  const validated = anularPesajeSchema.safeParse({
    motivoAnulacion: formData.get("motivoAnulacion"),
  });
  if (!validated.success) return;

  const pesaje = await prisma.pesaje.findUnique({ where: { id } });
  if (!pesaje) return;
  if (pesaje.estado !== "TARA_CAPTURADA" && pesaje.estado !== "CARGA_REGISTRADA") return;
  if (!canAccessUbicacion(usuario, pesaje.ubicacionId)) return;

  await prisma.pesaje.update({
    where: { id },
    data: { estado: "ANULADO", motivoAnulacion: validated.data.motivoAnulacion },
  });

  revalidatePath(`/pesajes/${id}`);
  revalidatePath("/pesajes");
}

export async function corregirPesaje(
  _state: CatalogFormState,
  formData: FormData,
): Promise<CatalogFormState> {
  const usuario = await requireRole(["ADMIN"]);

  const id = Number(formData.get("id"));
  const pesaje = await prisma.pesaje.findUnique({ where: { id }, include: { compra: true } });
  if (!pesaje) return { message: "Pesaje no encontrado." };
  if (pesaje.estado === "ANULADO") {
    return { message: "No se puede corregir un pesaje anulado." };
  }

  const validated = corregirPesajeSchema.safeParse({
    folioTicket: formData.get("folioTicket"),
    idOperacionBascula: formData.get("idOperacionBascula"),
    operadorNombre: formData.get("operadorNombre"),
    placas: formData.get("placas"),
    taraKg: formData.get("taraKg"),
    grossKg: formData.get("grossKg"),
    articuloId: formData.get("articuloId"),
    pesadorNombre: formData.get("pesadorNombre"),
    clienteDestinoReferencia: formData.get("clienteDestinoReferencia"),
    observaciones: formData.get("observaciones"),
    motivo: formData.get("motivo"),
  });
  if (!validated.success) {
    return { errors: validated.error.flatten().fieldErrors };
  }

  const data: Prisma.PesajeUpdateInput = {
    folioTicket: validated.data.folioTicket,
    idOperacionBascula: validated.data.idOperacionBascula || null,
    operadorNombre: validated.data.operadorNombre,
    placas: validated.data.placas,
    taraKg: validated.data.taraKg,
  };
  const detalleAnterior: Record<string, unknown> = {
    folioTicket: pesaje.folioTicket,
    idOperacionBascula: pesaje.idOperacionBascula,
    operadorNombre: pesaje.operadorNombre,
    placas: pesaje.placas,
    taraKg: pesaje.taraKg.toString(),
  };

  // Artículo y destino se capturan desde "registrar salida" (CARGA_REGISTRADA
  // en adelante) — corregibles mientras no exista compra, sin importar si el
  // pesaje ya llegó a báscula (COMPLETO) o no.
  if (pesaje.estado !== "TARA_CAPTURADA" && !pesaje.compra) {
    if (validated.data.articuloId) {
      data.articulo = { connect: { id: Number(validated.data.articuloId) } };
      detalleAnterior.articuloId = pesaje.articuloId;
    }
    data.clienteDestinoReferencia = validated.data.clienteDestinoReferencia || null;
    detalleAnterior.clienteDestinoReferencia = pesaje.clienteDestinoReferencia;
  }

  // Peso y pesador solo existen una vez que se concilió en báscula.
  if (pesaje.estado === "COMPLETO") {
    data.pesadorNombre = validated.data.pesadorNombre || null;
    data.observaciones = validated.data.observaciones || null;
    detalleAnterior.pesadorNombre = pesaje.pesadorNombre;
    detalleAnterior.observaciones = pesaje.observaciones;

    if (validated.data.grossKg != null) {
      const netoKg = validated.data.grossKg - validated.data.taraKg;
      if (netoKg <= 0) {
        return { errors: { grossKg: ["El peso cargado debe ser mayor a la tara."] } };
      }
      data.grossKg = validated.data.grossKg;
      data.netoKg = netoKg;
      detalleAnterior.grossKg = pesaje.grossKg?.toString();
      detalleAnterior.netoKg = pesaje.netoKg?.toString();
    }
  }

  await prisma.pesaje.update({ where: { id }, data });

  await registrarAuditLog({
    entidad: "Pesaje",
    entidadId: id,
    accion: "PESAJE_CORREGIDO",
    usuarioId: usuario.id,
    detalleAnterior,
    detalleNuevo: data as Record<string, unknown>,
    motivo: validated.data.motivo,
  });

  revalidatePath(`/pesajes/${id}`);
  revalidatePath("/pesajes");
  redirect(`/pesajes/${id}`);
}

export async function eliminarPesaje(formData: FormData) {
  const usuario = await requireRole(["ADMIN"]);

  const id = Number(formData.get("id"));
  const motivo = String(formData.get("motivo") ?? "").trim();
  if (!motivo) return;

  const pesaje = await prisma.pesaje.findUnique({ where: { id }, include: { compra: true } });
  if (!pesaje || pesaje.compra) return;

  await prisma.$transaction([
    prisma.evidencia.deleteMany({ where: { pesajeId: id } }),
    prisma.firma.deleteMany({ where: { pesajeId: id } }),
    prisma.pesajeEmpaque.deleteMany({ where: { pesajeId: id } }),
    prisma.pesaje.delete({ where: { id } }),
    // El lote nace con el cierre en báscula, antes de que exista compra — si
    // se elimina el pesaje sin compra todavía, el lote queda huérfano (nunca
    // tuvo compras, así que nunca pudo tener ventas ni aparecer disponible).
    ...(pesaje.loteId ? [prisma.lote.delete({ where: { id: pesaje.loteId } })] : []),
  ]);

  await registrarAuditLog({
    entidad: "Pesaje",
    entidadId: id,
    accion: "PESAJE_ELIMINADO",
    usuarioId: usuario.id,
    detalleAnterior: { folioTicket: pesaje.folioTicket, estado: pesaje.estado },
    motivo,
  });

  revalidatePath("/pesajes");
  redirect("/pesajes");
}
