import "server-only";

export function formatoFechaInput(fecha: Date) {
  return fecha.toISOString().slice(0, 10);
}

// Vigencia de 30 días por default en todas las listas (dashboard, pesajes,
// compras, ventas, lotes) — mismo criterio en toda la app para que "lo más
// reciente" signifique lo mismo en cualquier sección.
//
// Devuelve también desdeStr/hastaStr (el YYYY-MM-DD ya resuelto, como
// string) para que la página lo reuse tal cual en los <input type="date">
// y en la URL de encabezados/paginación/exportar — nunca hay que
// reconstruirlo con formatoFechaInput(desde) a partir del Date ya parseado:
// "${str}T23:59:59" sin zona se interpreta en hora LOCAL del servidor, y
// volver a pasar ese Date por toISOString() (que siempre da UTC) recorre la
// fecha un día en cualquier servidor que no esté en UTC+0.
export function resolverRangoFecha(desdeParam?: string, hastaParam?: string) {
  const hoy = new Date();
  const hace30Dias = new Date(hoy);
  hace30Dias.setDate(hace30Dias.getDate() - 30);

  const desdeStr = desdeParam || formatoFechaInput(hace30Dias);
  const hastaStr = hastaParam || formatoFechaInput(hoy);

  const desde = new Date(`${desdeStr}T00:00:00`);
  const hasta = new Date(`${hastaStr}T23:59:59`);
  return { desde, hasta, desdeStr, hastaStr };
}

export const OPCIONES_POR_PAGINA = [10, 20, 50, 100] as const;
export const POR_PAGINA_DEFAULT = 20;

export function resolverPorPagina(perPageParam?: string): number {
  const n = Number(perPageParam);
  return OPCIONES_POR_PAGINA.includes(n as (typeof OPCIONES_POR_PAGINA)[number])
    ? n
    : POR_PAGINA_DEFAULT;
}
