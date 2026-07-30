import "server-only";
import { prisma } from "@/lib/db";

export async function inventarioPorArticuloUbicacion(ubicacionId?: number) {
  const lotes = await prisma.lote.findMany({
    where: ubicacionId ? { ubicacionId } : undefined,
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

  const porClave = new Map<
    string,
    { ubicacion: string; articulo: string; comprado: number; vendido: number }
  >();

  for (const lote of lotes) {
    const clave = `${lote.ubicacionId}-${lote.articuloId}`;
    const comprado = lote.compras.reduce(
      (sum, c) => sum + Number(c.pesaje.netoKg ?? 0),
      0,
    );
    const vendido = lote.movimientos.reduce(
      (sum, m) => sum + Number(m.pesoAsignadoKg),
      0,
    );
    const actual = porClave.get(clave) ?? {
      ubicacion: lote.ubicacion.nombre,
      articulo: lote.articulo.nombre,
      comprado: 0,
      vendido: 0,
    };
    actual.comprado += comprado;
    actual.vendido += vendido;
    porClave.set(clave, actual);
  }

  return [...porClave.values()].map((e) => ({
    ...e,
    disponible: e.comprado - e.vendido,
  }));
}

export async function resumenPeriodo(
  desde: Date,
  hasta: Date,
  ubicacionId?: number,
) {
  const rangoFecha = { gte: desde, lte: hasta };
  const filtroUbicacion = ubicacionId ? { ubicacionId } : {};

  const [compras, ventas, pendientes] = await Promise.all([
    prisma.compra.findMany({
      where: { createdAt: rangoFecha, estado: { not: "CANCELADA" }, ...filtroUbicacion },
      include: { pesaje: { select: { netoKg: true } } },
    }),
    prisma.venta.findMany({
      where: { createdAt: rangoFecha, estado: "CERRADA", ...filtroUbicacion },
    }),
    prisma.venta.count({
      where: { estado: "PENDIENTE_APROBACION", ...filtroUbicacion },
    }),
  ]);

  return {
    compradoKg: compras.reduce((s, c) => s + Number(c.pesaje.netoKg ?? 0), 0),
    compradoImporte: compras.reduce((s, c) => s + Number(c.importeTotal), 0),
    vendidoKg: ventas.reduce((s, v) => s + Number(v.pesoVendidoKg), 0),
    vendidoImporte: ventas.reduce((s, v) => s + Number(v.importeTotal), 0),
    pendientesAprobacion: pendientes,
  };
}
