"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth/dal";
import { proveedorSchema } from "@/lib/validations/catalogos";
import type { CatalogFormState } from "@/components/catalog-form";

export async function saveProveedor(
  _state: CatalogFormState,
  formData: FormData,
): Promise<CatalogFormState> {
  await requireRole(["ADMIN", "SUPERVISOR"]);

  const validated = proveedorSchema.safeParse({
    nombre: formData.get("nombre"),
    rfc: formData.get("rfc"),
    telefono: formData.get("telefono"),
    netsuiteVendorId: formData.get("netsuiteVendorId"),
  });
  if (!validated.success) {
    return { errors: validated.error.flatten().fieldErrors };
  }

  const id = formData.get("id");
  const data = {
    nombre: validated.data.nombre,
    rfc: validated.data.rfc || null,
    telefono: validated.data.telefono || null,
    netsuiteVendorId: validated.data.netsuiteVendorId || null,
  };

  if (id) {
    await prisma.proveedor.update({ where: { id: Number(id) }, data });
  } else {
    await prisma.proveedor.create({ data });
  }

  revalidatePath("/catalogos/proveedores");
  redirect("/catalogos/proveedores");
}

export async function toggleProveedorActivo(formData: FormData) {
  await requireRole(["ADMIN", "SUPERVISOR"]);
  await prisma.proveedor.update({
    where: { id: Number(formData.get("id")) },
    data: { activo: formData.get("activo") === "true" },
  });
  revalidatePath("/catalogos/proveedores");
}
