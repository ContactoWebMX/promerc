import * as z from "zod";

export const crearVentaSchema = z.object({
  clienteId: z.string().min(1, { error: "Selecciona un cliente." }),
  loteId: z.string().min(1, { error: "Selecciona un lote." }),
  pesoAsignadoKg: z.coerce
    .number({ error: "Debe ser un número." })
    .positive({ error: "Debe ser mayor a 0." }),
  precioUnitarioKg: z.coerce
    .number({ error: "Debe ser un número." })
    .positive({ error: "Debe ser mayor a 0." }),
  operadorNombre: z.string().trim().toUpperCase().nullish(),
  placas: z.string().trim().toUpperCase().nullish(),
  fechaOperacion: z.string().min(1, { error: "Requerido" }),
});

export const reportarPesoVentaSchema = z.object({
  pesoReportadoClienteKg: z.coerce
    .number({ error: "Debe ser un número." })
    .positive({ error: "Debe ser mayor a 0." }),
  pesoReportadoEn: z.string().min(1, { error: "Requerido" }),
  motivoDiferencia: z.string().trim().toUpperCase().nullish(),
});

export const aprobarExcepcionSchema = z.object({
  justificacion: z.string().min(1, { error: "Indica la justificación." }).trim().toUpperCase(),
});

export const corregirVentaSchema = z.object({
  precioUnitarioKg: z.coerce
    .number({ error: "Debe ser un número." })
    .positive({ error: "Debe ser mayor a 0." }),
  pesoReportadoClienteKg: z.coerce
    .number({ error: "Debe ser un número." })
    .positive({ error: "Debe ser mayor a 0." })
    .nullish(),
  pesoReportadoEn: z.string().trim().nullish(),
  motivoDiferencia: z.string().trim().toUpperCase().nullish(),
  fechaOperacion: z.string().min(1, { error: "Requerido" }),
  motivo: z.string().min(1, { error: "Indica el motivo de la corrección." }).trim().toUpperCase(),
});
