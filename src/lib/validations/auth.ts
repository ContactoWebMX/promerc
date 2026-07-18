import * as z from "zod";

export const loginSchema = z.object({
  email: z.email({ error: "Correo inválido." }).trim(),
  password: z.string().min(1, { error: "Ingresa tu contraseña." }),
});

export const requestResetSchema = z.object({
  email: z.email({ error: "Correo inválido." }).trim(),
});

export const resetPasswordSchema = z.object({
  password: z
    .string()
    .min(8, { error: "Debe tener al menos 8 caracteres." })
    .regex(/[a-zA-Z]/, { error: "Debe contener al menos una letra." })
    .regex(/[0-9]/, { error: "Debe contener al menos un número." }),
});
