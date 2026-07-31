"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth/dal";
import { isUniqueConstraintError } from "@/lib/catalog";
import { ubicacionSchema } from "@/lib/validations/catalogos";
import type { CatalogFormState } from "@/components/catalog-form";

export async function saveUbicacion(
  _state: CatalogFormState,
  formData: FormData,
): Promise<CatalogFormState> {
  await requireRole(["ADMIN", "SUPERVISOR"]);

  const validated = ubicacionSchema.safeParse({
    nombre: formData.get("nombre"),
    codigo: formData.get("codigo"),
    netsuiteLocationId: formData.get("netsuiteLocationId"),
  });
  if (!validated.success) {
    return { errors: validated.error.flatten().fieldErrors };
  }

  const id = formData.get("id");
  const data = {
    nombre: validated.data.nombre,
    codigo: validated.data.codigo,
    netsuiteLocationId: validated.data.netsuiteLocationId || null,
  };

  try {
    if (id) {
      await prisma.ubicacion.update({ where: { id: Number(id) }, data });
    } else {
      await prisma.ubicacion.create({ data });
    }
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return { message: "Ya existe una ubicación con ese código." };
    }
    throw error;
  }

  revalidatePath("/catalogos/ubicaciones");
  redirect("/catalogos/ubicaciones");
}

export async function toggleUbicacionActivo(formData: FormData) {
  await requireRole(["ADMIN", "SUPERVISOR"]);
  await prisma.ubicacion.update({
    where: { id: Number(formData.get("id")) },
    data: { activo: formData.get("activo") === "true" },
  });
  revalidatePath("/catalogos/ubicaciones");
}
