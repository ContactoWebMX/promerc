"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth/dal";
import { reglaNotificacionSchema } from "@/lib/validations/catalogos";
import type { CatalogFormState } from "@/components/catalog-form";

export async function saveReglaNotificacion(
  _state: CatalogFormState,
  formData: FormData,
): Promise<CatalogFormState> {
  await requireRole(["ADMIN"]);

  const validated = reglaNotificacionSchema.safeParse({
    tipo: formData.get("tipo"),
    usuarioId: formData.get("usuarioId"),
    ubicacionId: formData.get("ubicacionId"),
    canalInApp: formData.get("canalInApp"),
    canalCorreo: formData.get("canalCorreo"),
  });
  if (!validated.success) {
    return { errors: validated.error.flatten().fieldErrors };
  }

  const usuarioId = Number(validated.data.usuarioId);
  // Mismo criterio que el cast de "role" en usuarios/actions.ts: el schema
  // ya validó que es uno de los 4 valores del enum, zod solo lo tipa como
  // string genérico.
  const tipo = validated.data.tipo as
    | "PESAJE_COMPLETADO"
    | "COMPRA_REGISTRADA"
    | "VENTA_CERRADA"
    | "VENTA_REQUIERE_APROBACION";

  // Solo ADMIN/SUPERVISOR pueden aprobar una excepción de tolerancia
  // (aprobarExcepcionTolerancia en ventas/[id]/actions.ts ya exige ese rol)
  // — configurar aquí a alguien más sería una regla que nunca sirve.
  if (tipo === "VENTA_REQUIERE_APROBACION") {
    const destinatario = await prisma.usuario.findUnique({ where: { id: usuarioId } });
    if (!destinatario || (destinatario.role !== "ADMIN" && destinatario.role !== "SUPERVISOR")) {
      return {
        errors: {
          usuarioId: [
            "Solo un ADMIN o SUPERVISOR puede recibir esta notificación — son los únicos que pueden aprobar.",
          ],
        },
      };
    }
  }

  const data = {
    tipo,
    usuarioId,
    ubicacionId: validated.data.ubicacionId ? Number(validated.data.ubicacionId) : null,
    canalInApp: validated.data.canalInApp === "true",
    canalCorreo: validated.data.canalCorreo === "true",
  };

  const id = formData.get("id");
  if (id) {
    await prisma.reglaNotificacion.update({ where: { id: Number(id) }, data });
  } else {
    await prisma.reglaNotificacion.create({ data });
  }

  revalidatePath("/catalogos/notificaciones");
  redirect("/catalogos/notificaciones");
}

export async function toggleReglaNotificacionActivo(formData: FormData) {
  await requireRole(["ADMIN"]);
  await prisma.reglaNotificacion.update({
    where: { id: Number(formData.get("id")) },
    data: { activo: formData.get("activo") === "true" },
  });
  revalidatePath("/catalogos/notificaciones");
}
