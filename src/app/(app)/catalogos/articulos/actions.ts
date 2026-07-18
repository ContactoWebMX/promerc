"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth/dal";
import { isUniqueConstraintError } from "@/lib/catalog";
import { articuloSchema } from "@/lib/validations/catalogos";
import type { CatalogFormState } from "@/components/catalog-form";

export async function saveArticulo(
  _state: CatalogFormState,
  formData: FormData,
): Promise<CatalogFormState> {
  await requireRole(["ADMIN", "SUPERVISOR"]);

  const validated = articuloSchema.safeParse({
    nombre: formData.get("nombre"),
  });
  if (!validated.success) {
    return { errors: validated.error.flatten().fieldErrors };
  }

  const id = formData.get("id");

  try {
    if (id) {
      await prisma.articulo.update({
        where: { id: Number(id) },
        data: validated.data,
      });
    } else {
      await prisma.articulo.create({ data: validated.data });
    }
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return { message: "Ya existe un artículo con ese nombre." };
    }
    throw error;
  }

  revalidatePath("/catalogos/articulos");
  redirect("/catalogos/articulos");
}

export async function toggleArticuloActivo(formData: FormData) {
  await requireRole(["ADMIN", "SUPERVISOR"]);
  await prisma.articulo.update({
    where: { id: Number(formData.get("id")) },
    data: { activo: formData.get("activo") === "true" },
  });
  revalidatePath("/catalogos/articulos");
}
