import { getCurrentUser, canAccessUbicacion } from "@/lib/auth/dal";
import { prisma } from "@/lib/db";
import { readStoredFile } from "@/lib/storage";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const usuario = await getCurrentUser();
  const { id } = await params;

  const firma = await prisma.firma.findUnique({
    where: { id: Number(id) },
    include: {
      pesaje: { select: { ubicacionId: true } },
      venta: { select: { ubicacionId: true } },
    },
  });

  if (!firma || !firma.imagenFirma) {
    return new Response(null, { status: 404 });
  }

  const ubicacionId = firma.pesaje?.ubicacionId ?? firma.venta?.ubicacionId ?? null;
  if (!canAccessUbicacion(usuario, ubicacionId)) {
    return new Response(null, { status: 403 });
  }

  const buffer = await readStoredFile(firma.imagenFirma);
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "private, max-age=0, no-store",
    },
  });
}
