import * as z from "zod";

export const crearPesajeSchema = z.object({
  folioTicket: z.string().min(1, { error: "Requerido" }).trim(),
  idOperacionBascula: z.string().trim().nullish(),
  fechaTicket: z.string().trim().nullish(),
  horaTicket: z.string().trim().nullish(),
  ubicacionId: z.string().min(1, { error: "Selecciona una ubicación." }),
  proveedorId: z.string().min(1, { error: "Selecciona un proveedor." }),
  operadorNombre: z.string().min(1, { error: "Requerido" }).trim(),
  placas: z.string().min(1, { error: "Requerido" }).trim(),
  taraKg: z.coerce
    .number({ error: "Debe ser un número." })
    .positive({ error: "Debe ser mayor a 0." }),
});

// Paso 1 — al cargar el camión, antes de báscula: qué se lleva y quién
// autoriza la salida. Todavía no se conoce el peso.
export const registrarSalidaSchema = z.object({
  articuloId: z.string().min(1, { error: "Selecciona un artículo." }),
  clienteDestinoReferencia: z.string().trim().nullish(),
  firmaSalidaNombre: z
    .string()
    .min(1, { error: "Falta el nombre de quien autoriza la salida." })
    .trim(),
});

// Paso 2 — al pasar por báscula: se concilia el ticket con el peso real.
export const cerrarPesajeSchema = z.object({
  grossKg: z.coerce
    .number({ error: "Debe ser un número." })
    .positive({ error: "Debe ser mayor a 0." }),
  pesadorNombre: z.string().min(1, { error: "Requerido" }).trim(),
  observaciones: z.string().trim().nullish(),
  fechaTicket: z.string().trim().nullish(),
  horaTicket: z.string().trim().nullish(),
});

export const anularPesajeSchema = z.object({
  motivoAnulacion: z.string().min(1, { error: "Indica el motivo." }).trim(),
});

export const corregirPesajeSchema = z.object({
  folioTicket: z.string().min(1, { error: "Requerido" }).trim(),
  idOperacionBascula: z.string().trim().nullish(),
  operadorNombre: z.string().min(1, { error: "Requerido" }).trim(),
  placas: z.string().min(1, { error: "Requerido" }).trim(),
  taraKg: z.coerce
    .number({ error: "Debe ser un número." })
    .positive({ error: "Debe ser mayor a 0." }),
  grossKg: z.coerce
    .number({ error: "Debe ser un número." })
    .positive({ error: "Debe ser mayor a 0." })
    .nullish(),
  articuloId: z.string().trim().nullish(),
  pesadorNombre: z.string().trim().nullish(),
  clienteDestinoReferencia: z.string().trim().nullish(),
  observaciones: z.string().trim().nullish(),
  motivo: z.string().min(1, { error: "Indica el motivo de la corrección." }).trim(),
});
