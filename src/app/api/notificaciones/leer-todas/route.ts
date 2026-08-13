import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/dal";
import { prisma } from "@/lib/db";

export async function POST() {
  const usuario = await getCurrentUser();
  await prisma.notificacionDestinatario.updateMany({
    where: { usuarioId: usuario.id, leidoEn: null },
    data: { leidoEn: new Date() },
  });
  return NextResponse.json({ ok: true });
}
