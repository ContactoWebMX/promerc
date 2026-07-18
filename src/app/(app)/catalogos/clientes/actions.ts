"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth/dal";
import { clienteSchema } from "@/lib/validations/catalogos";
import type { CatalogFormState } from "@/components/catalog-form";

export async function saveCliente(
  _state: CatalogFormState,
  formData: FormData,
): Promise<CatalogFormState> {
  await requireRole(["ADMIN", "SUPERVISOR"]);

  const validated = clienteSchema.safeParse({
    nombre: formData.get("nombre"),
    rfc: formData.get("rfc"),
    telefono: formData.get("telefono"),
  });
  if (!validated.success) {
    return { errors: validated.error.flatten().fieldErrors };
  }

  const id = formData.get("id");
  const data = {
    nombre: validated.data.nombre,
    rfc: validated.data.rfc || null,
    telefono: validated.data.telefono || null,
  };

  if (id) {
    await prisma.cliente.update({ where: { id: Number(id) }, data });
  } else {
    await prisma.cliente.create({ data });
  }

  revalidatePath("/catalogos/clientes");
  redirect("/catalogos/clientes");
}

export async function toggleClienteActivo(formData: FormData) {
  await requireRole(["ADMIN", "SUPERVISOR"]);
  await prisma.cliente.update({
    where: { id: Number(formData.get("id")) },
    data: { activo: formData.get("activo") === "true" },
  });
  revalidatePath("/catalogos/clientes");
}
