"use server";

import crypto from "node:crypto";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";
import { sendPasswordResetEmail } from "@/lib/email";
import {
  requestResetSchema,
  resetPasswordSchema,
} from "@/lib/validations/auth";

const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hora

export type RequestResetState =
  | { errors?: { email?: string[] }; message?: string }
  | undefined;

export async function requestPasswordReset(
  _state: RequestResetState,
  formData: FormData,
): Promise<RequestResetState> {
  const validatedFields = requestResetSchema.safeParse({
    email: formData.get("email"),
  });

  if (!validatedFields.success) {
    return { errors: validatedFields.error.flatten().fieldErrors };
  }

  const usuario = await prisma.usuario.findUnique({
    where: { email: validatedFields.data.email },
  });

  // No se revela si el correo existe, para no facilitar enumerar usuarios.
  if (usuario && usuario.activo) {
    const rawToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");

    await prisma.passwordResetToken.create({
      data: {
        usuarioId: usuario.id,
        tokenHash,
        expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS),
      },
    });

    const resetUrl = `${process.env.APP_URL}/reset-password/${rawToken}`;
    await sendPasswordResetEmail(usuario.email, resetUrl);
  }

  return {
    message:
      "Si el correo existe en el sistema, te enviamos un enlace para recuperar tu contraseña.",
  };
}

export type ResetPasswordState =
  | { errors?: { password?: string[] }; message?: string }
  | undefined;

export async function resetPassword(
  _state: ResetPasswordState,
  formData: FormData,
): Promise<ResetPasswordState> {
  const validatedFields = resetPasswordSchema.safeParse({
    password: formData.get("password"),
  });

  if (!validatedFields.success) {
    return { errors: validatedFields.error.flatten().fieldErrors };
  }

  const token = String(formData.get("token") ?? "");
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  const resetToken = await prisma.passwordResetToken.findUnique({
    where: { tokenHash },
  });

  if (
    !resetToken ||
    resetToken.usedAt ||
    resetToken.expiresAt.getTime() < Date.now()
  ) {
    return { message: "El enlace no es válido o ya expiró. Solicita uno nuevo." };
  }

  const passwordHash = await hashPassword(validatedFields.data.password);

  await prisma.$transaction([
    prisma.usuario.update({
      where: { id: resetToken.usuarioId },
      data: { passwordHash },
    }),
    prisma.passwordResetToken.update({
      where: { id: resetToken.id },
      data: { usedAt: new Date() },
    }),
  ]);

  redirect("/login");
}
