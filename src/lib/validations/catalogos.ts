import * as z from "zod";
import { RoleUsuario, TipoNotificacion } from "@/generated/prisma/enums";

export const ubicacionSchema = z.object({
  nombre: z.string().min(1, { error: "Requerido" }).trim(),
  codigo: z.string().min(1, { error: "Requerido" }).trim(),
  netsuiteLocationId: z.string().trim().nullish(),
});

const nombreRfcTelefonoSchema = z.object({
  nombre: z.string().min(1, { error: "Requerido" }).trim(),
  rfc: z.string().trim().nullish(),
  telefono: z.string().trim().nullish(),
});
export const proveedorSchema = nombreRfcTelefonoSchema.extend({
  netsuiteVendorId: z.string().trim().nullish(),
});
export const clienteSchema = nombreRfcTelefonoSchema.extend({
  netsuiteCustomerId: z.string().trim().nullish(),
});

const nombreSchema = z.object({
  nombre: z.string().min(1, { error: "Requerido" }).trim(),
});
export const articuloSchema = nombreSchema.extend({
  netsuiteItemId: z.string().trim().nullish(),
});
export const unidadEmpaqueSchema = nombreSchema;

export const usuarioSchema = z.object({
  nombre: z.string().min(1, { error: "Requerido" }).trim(),
  email: z.email({ error: "Correo inválido." }).trim(),
  role: z.enum(Object.values(RoleUsuario) as [string, ...string[]], {
    error: "Selecciona un rol.",
  }),
  ubicacionId: z.string().nullish(),
  clienteId: z.string().nullish(),
  netsuiteEmployeeId: z.string().trim().nullish(),
});

export const centroAprobacionSchema = z.object({
  nombre: z.string().min(1, { error: "Requerido" }).trim(),
  netsuiteId: z.string().min(1, { error: "Requerido" }).trim(),
});

export const toleranciaSchema = z.object({
  porcentajeUmbral: z.coerce
    .number({ error: "Debe ser un número." })
    .positive({ error: "Debe ser mayor a 0." })
    .max(100, { error: "No puede ser mayor a 100." }),
});

export const usuarioPasswordSchema = z
  .string()
  .min(8, { error: "Debe tener al menos 8 caracteres." })
  .regex(/[a-zA-Z]/, { error: "Debe contener al menos una letra." })
  .regex(/[0-9]/, { error: "Debe contener al menos un número." });

export const reglaNotificacionSchema = z.object({
  tipo: z.enum(Object.values(TipoNotificacion) as [string, ...string[]], {
    error: "Selecciona un tipo de evento.",
  }),
  usuarioId: z.string().min(1, { error: "Selecciona un usuario." }),
  ubicacionId: z.string().nullish(),
  canalInApp: z.enum(["true", "false"], { error: "Selecciona una opción." }),
  canalCorreo: z.enum(["true", "false"], { error: "Selecciona una opción." }),
});
