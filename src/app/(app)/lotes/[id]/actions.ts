"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth/dal";
import { isUniqueConstraintError } from "@/lib/catalog";
import { registrarAuditLog } from "@/lib/audit";
import { corregirFolioLoteSchema } from "@/lib/validations/compras";
import type { CatalogFormState } from "@/components/catalog-form";

export async function corregirFolioLote(
  _state: CatalogFormState,
  formData: FormData,
): Promise<CatalogFormState> {
  const usuario = await requireRole(["ADMIN", "SUPERVISOR"]);

  const id = Number(formData.get("id"));
  const lote = await prisma.lote.findUnique({ where: { id } });
  if (!lote) return { message: "Lote no encontrado." };

  const validated = corregirFolioLoteSchema.safeParse({
    folio: formData.get("folio"),
    motivo: formData.get("motivo"),
  });
  if (!validated.success) {
    return { errors: validated.error.flatten().fieldErrors };
  }

  if (validated.data.folio === lote.folio) {
    return { message: "El folio no cambió." };
  }

  try {
    await prisma.lote.update({
      where: { id },
      data: { folio: validated.data.folio, folioCorregido: true },
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return { errors: { folio: ["Ya existe un lote con ese folio."] } };
    }
    throw error;
  }

  await registrarAuditLog({
    entidad: "Lote",
    entidadId: id,
    accion: "FOLIO_CORREGIDO",
    usuarioId: usuario.id,
    detalleAnterior: { folio: lote.folio },
    detalleNuevo: { folio: validated.data.folio },
    motivo: validated.data.motivo,
  });

  revalidatePath(`/lotes/${id}`);
  revalidatePath("/lotes");
  redirect(`/lotes/${id}`);
}
