"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth/dal";
import { centroAprobacionSchema } from "@/lib/validations/catalogos";
import type { CatalogFormState } from "@/components/catalog-form";

export async function saveCentroAprobacion(
  _state: CatalogFormState,
  formData: FormData,
): Promise<CatalogFormState> {
  await requireRole(["ADMIN", "SUPERVISOR"]);

  const validated = centroAprobacionSchema.safeParse({
    nombre: formData.get("nombre"),
    netsuiteId: formData.get("netsuiteId"),
  });
  if (!validated.success) {
    return { errors: validated.error.flatten().fieldErrors };
  }

  const id = formData.get("id");

  if (id) {
    await prisma.centroAprobacion.update({ where: { id: Number(id) }, data: validated.data });
  } else {
    await prisma.centroAprobacion.create({ data: validated.data });
  }

  revalidatePath("/catalogos/centro-aprobacion");
  redirect("/catalogos/centro-aprobacion");
}

export async function toggleCentroAprobacionActivo(formData: FormData) {
  await requireRole(["ADMIN", "SUPERVISOR"]);
  await prisma.centroAprobacion.update({
    where: { id: Number(formData.get("id")) },
    data: { activo: formData.get("activo") === "true" },
  });
  revalidatePath("/catalogos/centro-aprobacion");
}

// Solo un Centro de Aprobación puede ser el predeterminado a la vez — es el
// que se manda en cada Compra/Venta enviada a NetSuite (ver src/lib/netsuite.ts).
export async function marcarCentroAprobacionPredeterminado(formData: FormData) {
  await requireRole(["ADMIN", "SUPERVISOR"]);
  const id = Number(formData.get("id"));

  await prisma.$transaction([
    prisma.centroAprobacion.updateMany({
      where: { id: { not: id } },
      data: { predeterminado: false },
    }),
    prisma.centroAprobacion.update({ where: { id }, data: { predeterminado: true } }),
  ]);

  revalidatePath("/catalogos/centro-aprobacion");
}
