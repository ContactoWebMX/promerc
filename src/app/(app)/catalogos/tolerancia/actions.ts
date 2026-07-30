"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth/dal";
import { toleranciaSchema } from "@/lib/validations/catalogos";
import type { CatalogFormState } from "@/components/catalog-form";

export async function guardarToleranciaGlobal(
  _state: CatalogFormState,
  formData: FormData,
): Promise<CatalogFormState> {
  await requireRole(["ADMIN"]);

  const validated = toleranciaSchema.safeParse({
    porcentajeUmbral: formData.get("porcentajeUmbral"),
  });
  if (!validated.success) {
    return { errors: validated.error.flatten().fieldErrors };
  }

  const existente = await prisma.toleranciaConfig.findFirst({ where: { articuloId: null } });
  if (existente) {
    await prisma.toleranciaConfig.update({
      where: { id: existente.id },
      data: validated.data,
    });
  } else {
    await prisma.toleranciaConfig.create({
      data: { ...validated.data, articuloId: null },
    });
  }

  revalidatePath("/catalogos/tolerancia");
  redirect("/catalogos/tolerancia");
}

export async function guardarToleranciaArticulo(
  _state: CatalogFormState,
  formData: FormData,
): Promise<CatalogFormState> {
  await requireRole(["ADMIN"]);

  const articuloId = Number(formData.get("articuloId"));
  if (!articuloId) {
    return { errors: { articuloId: ["Selecciona un artículo."] } };
  }

  const validated = toleranciaSchema.safeParse({
    porcentajeUmbral: formData.get("porcentajeUmbral"),
  });
  if (!validated.success) {
    return { errors: validated.error.flatten().fieldErrors };
  }

  const existente = await prisma.toleranciaConfig.findFirst({ where: { articuloId } });
  if (existente) {
    await prisma.toleranciaConfig.update({
      where: { id: existente.id },
      data: validated.data,
    });
  } else {
    await prisma.toleranciaConfig.create({
      data: { ...validated.data, articuloId },
    });
  }

  revalidatePath("/catalogos/tolerancia");
  redirect("/catalogos/tolerancia");
}

export async function eliminarToleranciaArticulo(formData: FormData) {
  await requireRole(["ADMIN"]);
  const id = Number(formData.get("id"));
  const config = await prisma.toleranciaConfig.findUnique({ where: { id } });
  if (!config || config.articuloId === null) return;
  await prisma.toleranciaConfig.delete({ where: { id } });
  revalidatePath("/catalogos/tolerancia");
}
