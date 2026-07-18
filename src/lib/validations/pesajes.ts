import * as z from "zod";

export const crearPesajeSchema = z.object({
  folioTicket: z.string().min(1, { error: "Requerido" }).trim(),
  ubicacionId: z.string().min(1, { error: "Selecciona una ubicación." }),
  articuloId: z.string().min(1, { error: "Selecciona un artículo." }),
  proveedorId: z.string().min(1, { error: "Selecciona un proveedor." }),
  operadorNombre: z.string().min(1, { error: "Requerido" }).trim(),
  placas: z.string().min(1, { error: "Requerido" }).trim(),
  colorCamion: z.string().trim().nullish(),
  tipoCamion: z.string().trim().nullish(),
  taraKg: z.coerce
    .number({ error: "Debe ser un número." })
    .positive({ error: "Debe ser mayor a 0." }),
});

export const cerrarPesajeSchema = z.object({
  grossKg: z.coerce
    .number({ error: "Debe ser un número." })
    .positive({ error: "Debe ser mayor a 0." }),
  pesadorNombre: z.string().min(1, { error: "Requerido" }).trim(),
  observaciones: z.string().trim().nullish(),
  clienteDestinoReferencia: z.string().trim().nullish(),
  firmaSalidaNombre: z.string().min(1, { error: "Falta el nombre de quien entrega." }).trim(),
  firmaSupervisorNombre: z
    .string()
    .min(1, { error: "Falta el nombre del supervisor que valida." })
    .trim(),
});

export const anularPesajeSchema = z.object({
  motivoAnulacion: z.string().min(1, { error: "Indica el motivo." }).trim(),
});
