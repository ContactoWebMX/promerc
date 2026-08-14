import * as z from "zod";

export const crearCompraSchema = z.object({
  precioUnitarioKg: z.coerce
    .number({ error: "Debe ser un número." })
    .positive({ error: "Debe ser mayor a 0." }),
  fechaOperacion: z.string().min(1, { error: "Requerido" }),
});

export const corregirFolioLoteSchema = z.object({
  folio: z.string().min(1, { error: "Requerido" }).trim().toUpperCase(),
  motivo: z.string().min(1, { error: "Indica el motivo del cambio." }).trim().toUpperCase(),
});

export const corregirCompraSchema = z.object({
  precioUnitarioKg: z.coerce
    .number({ error: "Debe ser un número." })
    .positive({ error: "Debe ser mayor a 0." }),
  fechaOperacion: z.string().min(1, { error: "Requerido" }),
  motivo: z.string().min(1, { error: "Indica el motivo del cambio." }).trim().toUpperCase(),
});

export const anularCompraSchema = z.object({
  motivo: z.string().min(1, { error: "Indica el motivo de la anulación." }).trim().toUpperCase(),
});

export const eliminarCompraSchema = z.object({
  motivo: z.string().min(1, { error: "Indica el motivo de la eliminación." }).trim().toUpperCase(),
});
