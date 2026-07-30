import "server-only";
import { prisma } from "@/lib/db";

const UMBRAL_RESPALDO_PCT = 3;

// Compartido entre la acción que valida (reportarPesoVenta/corregirVenta) y
// la página que muestra el umbral vigente en el formulario — antes vivía
// duplicado/privado dentro de una sola acción.
export async function obtenerUmbralTolerancia(articuloId: number): Promise<number> {
  const especifico = await prisma.toleranciaConfig.findFirst({
    where: { articuloId },
  });
  if (especifico) return Number(especifico.porcentajeUmbral);

  const global = await prisma.toleranciaConfig.findFirst({
    where: { articuloId: null },
  });
  return global ? Number(global.porcentajeUmbral) : UMBRAL_RESPALDO_PCT;
}
