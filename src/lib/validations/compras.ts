import * as z from "zod";

export const crearCompraSchema = z.object({
  precioUnitarioKg: z.coerce
    .number({ error: "Debe ser un número." })
    .positive({ error: "Debe ser mayor a 0." }),
});

export const corregirFolioLoteSchema = z.object({
  folio: z.string().min(1, { error: "Requerido" }).trim(),
  motivo: z.string().min(1, { error: "Indica el motivo del cambio." }).trim(),
});

export const corregirCompraSchema = z.object({
  precioUnitarioKg: z.coerce
    .number({ error: "Debe ser un número." })
    .positive({ error: "Debe ser mayor a 0." }),
  fechaOperacion: z.string().min(1, { error: "Requerido" }),
  motivo: z.string().min(1, { error: "Indica el motivo del cambio." }).trim(),
});

export const anularCompraSchema = z.object({
  motivo: z.string().min(1, { error: "Indica el motivo de la anulación." }).trim(),
});
