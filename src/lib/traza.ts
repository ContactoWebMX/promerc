import "server-only";
import { prisma } from "@/lib/db";

export type TrazaCadena = {
  pesaje: { id: number; folioTicket: string; estado: string } | null;
  lote: { id: number; folio: string; estado: string } | null;
  compra: { id: number } | null;
  ventas: { id: number; estado: string; cliente: { nombre: string } }[];
};

// La cadena es Pesaje→Lote→Compra→Venta: el lote nace al cerrar el pesaje en
// báscula (ver cerrarPesaje en pesajes/[id]/actions.ts), antes de que exista
// la compra — la compra solo captura precio y puede registrarse después. De
// Lote a Venta es N:M vía LoteMovimiento: un lote puede venderse a varios
// clientes en el tiempo. trazaDesdeLote solo resuelve el tramo Pesaje/Compra
// cuando el lote tiene exactamente 1 pesaje — los lotes históricos agrupados
// por día (antes de este cambio) quedan sin ese tramo.

export async function trazaDesdePesaje(pesajeId: number): Promise<TrazaCadena | null> {
  const pesaje = await prisma.pesaje.findUnique({
    where: { id: pesajeId },
    select: {
      id: true,
      folioTicket: true,
      estado: true,
      compra: { select: { id: true } },
      lote: {
        select: {
          id: true,
          folio: true,
          estado: true,
          movimientos: {
            select: {
              venta: {
                select: { id: true, estado: true, cliente: { select: { nombre: true } } },
              },
            },
          },
        },
      },
    },
  });
  if (!pesaje) return null;

  return {
    pesaje: { id: pesaje.id, folioTicket: pesaje.folioTicket, estado: pesaje.estado },
    lote: pesaje.lote
      ? { id: pesaje.lote.id, folio: pesaje.lote.folio, estado: pesaje.lote.estado }
      : null,
    compra: pesaje.compra ? { id: pesaje.compra.id } : null,
    ventas: pesaje.lote?.movimientos.map((m) => m.venta) ?? [],
  };
}

export async function trazaDesdeLote(loteId: number): Promise<TrazaCadena | null> {
  const lote = await prisma.lote.findUnique({
    where: { id: loteId },
    select: {
      id: true,
      folio: true,
      estado: true,
      pesajes: {
        select: {
          id: true,
          folioTicket: true,
          estado: true,
          compra: { select: { id: true } },
        },
      },
      movimientos: {
        select: {
          venta: { select: { id: true, estado: true, cliente: { select: { nombre: true } } } },
        },
      },
    },
  });
  if (!lote) return null;

  const pesaje = lote.pesajes.length === 1 ? lote.pesajes[0] : null;

  return {
    pesaje: pesaje ? { id: pesaje.id, folioTicket: pesaje.folioTicket, estado: pesaje.estado } : null,
    lote: { id: lote.id, folio: lote.folio, estado: lote.estado },
    compra: pesaje?.compra ? { id: pesaje.compra.id } : null,
    ventas: lote.movimientos.map((m) => m.venta),
  };
}
