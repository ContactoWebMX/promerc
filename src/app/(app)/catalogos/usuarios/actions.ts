"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth/dal";
import { hashPassword } from "@/lib/auth/password";
import { isUniqueConstraintError } from "@/lib/catalog";
import { usuarioSchema, usuarioPasswordSchema } from "@/lib/validations/catalogos";
import type { CatalogFormState } from "@/components/catalog-form";

export async function saveUsuario(
  _state: CatalogFormState,
  formData: FormData,
): Promise<CatalogFormState> {
  await requireRole(["ADMIN"]);

  const validated = usuarioSchema.safeParse({
    nombre: formData.get("nombre"),
    email: formData.get("email"),
    role: formData.get("role"),
    ubicacionId: formData.get("ubicacionId"),
    clienteId: formData.get("clienteId"),
    netsuiteEmployeeId: formData.get("netsuiteEmployeeId"),
  });
  if (!validated.success) {
    return { errors: validated.error.flatten().fieldErrors };
  }

  const id = formData.get("id");
  const rawPassword = String(formData.get("password") ?? "");

  if (!id && !rawPassword) {
    return {
      errors: { password: ["La contraseña es obligatoria para usuarios nuevos."] },
    };
  }
  if (rawPassword) {
    const passwordCheck = usuarioPasswordSchema.safeParse(rawPassword);
    if (!passwordCheck.success) {
      return {
        errors: { password: passwordCheck.error.flatten().formErrors },
      };
    }
  }

  const { nombre, email, role } = validated.data;
  const ubicacionId = validated.data.ubicacionId
    ? Number(validated.data.ubicacionId)
    : null;
  const clienteId =
    role === "CLIENTE" && validated.data.clienteId
      ? Number(validated.data.clienteId)
      : null;

  if (role === "CLIENTE" && !clienteId) {
    return {
      errors: {
        clienteId: ["Selecciona el cliente al que pertenece esta cuenta."],
      },
    };
  }

  const data = {
    nombre,
    email,
    role: role as "ADMIN" | "SUPERVISOR" | "OPERADOR" | "CLIENTE",
    ubicacionId,
    clienteId,
    netsuiteEmployeeId: validated.data.netsuiteEmployeeId || null,
  };

  try {
    if (id) {
      await prisma.usuario.update({
        where: { id: Number(id) },
        data: rawPassword
          ? { ...data, passwordHash: await hashPassword(rawPassword) }
          : data,
      });
    } else {
      await prisma.usuario.create({
        data: { ...data, passwordHash: await hashPassword(rawPassword) },
      });
    }
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return { message: "Ya existe un usuario con ese correo." };
    }
    throw error;
  }

  revalidatePath("/catalogos/usuarios");
  redirect("/catalogos/usuarios");
}

export async function toggleUsuarioActivo(formData: FormData) {
  await requireRole(["ADMIN"]);
  await prisma.usuario.update({
    where: { id: Number(formData.get("id")) },
    data: { activo: formData.get("activo") === "true" },
  });
  revalidatePath("/catalogos/usuarios");
}
