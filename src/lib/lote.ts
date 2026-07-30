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

// Un lote se crea uno por compra (== uno por pesaje, ya que Compra es 1:1 con
// Pesaje) para trazabilidad por operación: cada venta puede rastrearse hasta
// el camión/proveedor exacto que originó el material, vía LoteMovimiento
// (N:M con Venta). El folio sigue siendo correlativo por día
// (L-YYYYMMDD-###) — ### ahora cuenta operaciones del día, no lotes-resumen.
// El conteo + create no es atómico, así que ante una colisión de folio (dos
// compras concurrentes el mismo día) se reintenta un par de veces.
// ponytail: reintento optimista, no lock distribuido — suficiente para el
// volumen de una báscula; si el throughput crece, mover a una secuencia de BD.
export async function crearLoteParaCompra(
  ubicacionId: number,
  articuloId: number,
  fecha: Date = new Date(),
) {
  const { inicio, fin } = limitesDelDia(fecha);

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
// Una compra CANCELADA nunca aportó material real, así que no cuenta como
// "comprado" — ver actualizarEstadoLote para el mismo criterio.
export async function lotesConDisponible(articuloId?: number, ubicacionId?: number) {
  const lotes = await prisma.lote.findMany({
    where: {
      estado: "ABIERTO",
      ...(articuloId ? { articuloId } : {}),
      ...(ubicacionId ? { ubicacionId } : {}),
    },
    orderBy: { fecha: "desc" },
    include: {
      ubicacion: true,
      articulo: true,
      compras: {
        where: { estado: { not: "CANCELADA" } },
        select: { pesaje: { select: { netoKg: true } } },
      },
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

// Recalcula si un lote sigue teniendo saldo para vender y refleja eso en su
// estado (y en el de sus compras, que ahora siguen al lote): se cierra en
// cuanto una venta consume lo último que quedaba, y se reabre si esa venta
// se elimina. Si el lote todavía no tiene ninguna compra registrada (recién
// creado al cerrar el pesaje en báscula), se queda ABIERTO — cerrarlo ahí
// sería confundir "sin comprar todavía" con "ya se vendió todo".
export async function actualizarEstadoLote(loteId: number) {
  const lote = await prisma.lote.findUnique({
    where: { id: loteId },
    select: {
      compras: {
        where: { estado: { not: "CANCELADA" } },
        select: { id: true, pesaje: { select: { netoKg: true } } },
      },
      movimientos: { select: { pesoAsignadoKg: true } },
    },
  });
  if (!lote) return;

  const comprado = lote.compras.reduce((s, c) => s + Number(c.pesaje.netoKg ?? 0), 0);
  const asignado = lote.movimientos.reduce((s, m) => s + Number(m.pesoAsignadoKg), 0);
  const cerrado = comprado > 0 && comprado - asignado <= 0;

  await prisma.$transaction([
    prisma.lote.update({
      where: { id: loteId },
      data: { estado: cerrado ? "CERRADO" : "ABIERTO" },
    }),
    prisma.compra.updateMany({
      where: { id: { in: lote.compras.map((c) => c.id) } },
      data: { estado: cerrado ? "CERRADA" : "ABIERTA" },
    }),
  ]);
}
