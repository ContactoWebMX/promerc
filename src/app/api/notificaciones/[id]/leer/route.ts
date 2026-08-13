import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/dal";
import { prisma } from "@/lib/db";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const usuario = await getCurrentUser();
  const { id } = await params;

  // updateMany con el filtro de usuarioId incluido, no update({where:{id}})
  // solo — así la validación de pertenencia es atómica: si el id no es de
  // este usuario, no actualiza nada, sin necesitar un findUnique previo.
  await prisma.notificacionDestinatario.updateMany({
    where: { id: Number(id), usuarioId: usuario.id },
    data: { leidoEn: new Date() },
  });

  return NextResponse.json({ ok: true });
}
