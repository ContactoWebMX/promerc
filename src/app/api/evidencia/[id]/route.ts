import { getCurrentUser, canAccessUbicacion } from "@/lib/auth/dal";
import { prisma } from "@/lib/db";
import { readStoredFile } from "@/lib/storage";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const usuario = await getCurrentUser();
  const { id } = await params;

  const evidencia = await prisma.evidencia.findUnique({
    where: { id: Number(id) },
    include: {
      pesaje: { select: { ubicacionId: true } },
      venta: { select: { ubicacionId: true } },
    },
  });

  if (!evidencia) {
    return new Response(null, { status: 404 });
  }

  const ubicacionId = evidencia.pesaje?.ubicacionId ?? evidencia.venta?.ubicacionId ?? null;
  if (!canAccessUbicacion(usuario, ubicacionId)) {
    return new Response(null, { status: 403 });
  }

  const buffer = await readStoredFile(evidencia.rutaArchivo);
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": evidencia.mimeType,
      "Cache-Control": "private, max-age=0, no-store",
    },
  });
}
