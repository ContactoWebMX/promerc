import "server-only";
import { prisma } from "@/lib/db";
import { isUniqueConstraintError } from "@/lib/catalog";

function limitesDelDia(fecha: Date) {
  const inicio = new Date(fecha);
  inicio.setHours(0, 0, 0, 0);
  const fin = new Date(inicio);
  fin.setDate(fin.getDate() + 1);
  return { inicio, fin };
}

function formatoFecha(fecha: Date) {
  const y = fecha.getFullYear();
  const m = String(fecha.getMonth() + 1).padStart(2, "0");
  const d = String(fecha.getDate()).padStart(2, "0");
  return `${y}${m}${d}`;
}

// Un lote agrupa las compras de un artículo/ubicación por día de salida.
// El folio es correlativo por día (L-YYYYMMDD-###); el conteo + create no es
// atómico, así que ante una colisión de folio (dos compras concurrentes
// abriendo el primer lote del día) se reintenta un par de veces.
// ponytail: reintento optimista, no lock distribuido — suficiente para el
// volumen de una báscula; si el throughput crece, mover a una secuencia de BD.
export async function obtenerOCrearLoteDelDia(
  ubicacionId: number,
  articuloId: number,
  fecha: Date = new Date(),
) {
  const { inicio, fin } = limitesDelDia(fecha);

  const existente = await prisma.lote.findFirst({
    where: {
      ubicacionId,
      articuloId,
      estado: "ABIERTO",
      fecha: { gte: inicio, lt: fin },
    },
  });
  if (existente) return existente;

  for (let intento = 0; intento < 3; intento++) {
    const consecutivoHoy = await prisma.lote.count({
      where: { fecha: { gte: inicio, lt: fin } },
    });
    const folio = `L-${formatoFecha(inicio)}-${String(consecutivoHoy + 1).padStart(3, "0")}`;

    try {
      return await prisma.lote.create({
        data: { folio, ubicacionId, articuloId, fecha: inicio },
      });
    } catch (error) {
      if (isUniqueConstraintError(error) && intento < 2) continue;
      throw error;
    }
  }
  throw new Error("No se pudo generar el folio del lote.");
}

// Lotes con saldo disponible para vender (comprado - ya asignado a ventas).
export async function lotesConDisponible(articuloId?: number) {
  const lotes = await prisma.lote.findMany({
    where: { estado: "ABIERTO", ...(articuloId ? { articuloId } : {}) },
    orderBy: { fecha: "desc" },
    include: {
      ubicacion: true,
      articulo: true,
      compras: { select: { pesaje: { select: { netoKg: true } } } },
      movimientos: { select: { pesoAsignadoKg: true } },
    },
  });

  return lotes
    .map((lote) => {
      const comprado = lote.compras.reduce(
        (sum, c) => sum + Number(c.pesaje.netoKg ?? 0),
        0,
      );
      const asignado = lote.movimientos.reduce(
        (sum, m) => sum + Number(m.pesoAsignadoKg),
        0,
      );
      return { ...lote, comprado, disponible: comprado - asignado };
    })
    .filter((lote) => lote.disponible > 0);
}
