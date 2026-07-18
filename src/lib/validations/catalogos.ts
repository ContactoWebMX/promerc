import * as z from "zod";
import { RoleUsuario } from "@/generated/prisma/enums";

export const ubicacionSchema = z.object({
  nombre: z.string().min(1, { error: "Requerido" }).trim(),
  codigo: z.string().min(1, { error: "Requerido" }).trim(),
});

const nombreRfcTelefonoSchema = z.object({
  nombre: z.string().min(1, { error: "Requerido" }).trim(),
  rfc: z.string().trim().nullish(),
  telefono: z.string().trim().nullish(),
});
export const proveedorSchema = nombreRfcTelefonoSchema;
export const clienteSchema = nombreRfcTelefonoSchema;

const nombreSchema = z.object({
  nombre: z.string().min(1, { error: "Requerido" }).trim(),
});
export const articuloSchema = nombreSchema;
export const unidadEmpaqueSchema = nombreSchema;

export const usuarioSchema = z.object({
  nombre: z.string().min(1, { error: "Requerido" }).trim(),
  email: z.email({ error: "Correo inválido." }).trim(),
  role: z.enum(Object.values(RoleUsuario) as [string, ...string[]], {
    error: "Selecciona un rol.",
  }),
  ubicacionId: z.string().nullish(),
  clienteId: z.string().nullish(),
});

export const usuarioPasswordSchema = z
  .string()
  .min(8, { error: "Debe tener al menos 8 caracteres." })
  .regex(/[a-zA-Z]/, { error: "Debe contener al menos una letra." })
  .regex(/[0-9]/, { error: "Debe contener al menos un número." });
