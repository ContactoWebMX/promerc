"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { verifyPassword } from "@/lib/auth/password";
import { createSession } from "@/lib/auth/session";
import { loginSchema } from "@/lib/validations/auth";
import { deleteSession } from "@/lib/auth/session";

export type LoginFormState =
  | {
      errors?: { email?: string[]; password?: string[] };
      message?: string;
    }
  | undefined;

export async function login(
  _state: LoginFormState,
  formData: FormData,
): Promise<LoginFormState> {
  const validatedFields = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!validatedFields.success) {
    return { errors: validatedFields.error.flatten().fieldErrors };
  }

  const { email, password } = validatedFields.data;

  const usuario = await prisma.usuario.findUnique({ where: { email } });

  if (
    !usuario ||
    !usuario.activo ||
    !(await verifyPassword(usuario.passwordHash, password))
  ) {
    return { message: "Correo o contraseña incorrectos." };
  }

  await createSession({
    userId: usuario.id,
    role: usuario.role,
    ubicacionId: usuario.ubicacionId,
  });

  redirect("/");
}

export async function logout() {
  await deleteSession();
  redirect("/login");
}
