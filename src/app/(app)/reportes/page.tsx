import { getCurrentUser } from "@/lib/auth/dal";
import { inventarioPorArticuloUbicacion, resumenPeriodo } from "@/lib/reportes";

function formatoFechaInput(fecha: Date) {
  return fecha.toISOString().slice(0, 10);
}

export default async function ReportesPage({
  searchParams,
}: {
  searchParams: Promise<{ desde?: string; hasta?: string }>;
}) {
  const usuario = await getCurrentUser();
  const params = await searchParams;

  const hoy = new Date();
  const hace30Dias = new Date(hoy);
  hace30Dias.setDate(hace30Dias.getDate() - 30);

  const desde = params.desde ? new Date(`${params.desde}T00:00:00`) : hace30Dias;
  const hasta = params.hasta ? new Date(`${params.hasta}T23:59:59`) : hoy;

  const soloMiUbicacion = usuario.role !== "ADMIN" && usuario.role !== "SUPERVISOR";
  const ubicacionId = soloMiUbicacion ? (usuario.ubicacionId ?? -1) : undefined;

  const [resumen, inventario] = await Promise.all([
    resumenPeriodo(desde, hasta, ubicacionId),
    inventarioPorArticuloUbicacion(),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold">Reportes</h1>

      <form method="get" className="flex items-end gap-3 text-sm">
        <div className="flex flex-col gap-1">
          <label htmlFor="desde">Desde</label>
          <input
            id="desde"
            name="desde"
            type="date"
            defaultValue={formatoFechaInput(desde)}
            className="rounded-md border border-black/15 px-3 py-2 dark:border-white/20 dark:bg-black"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="hasta">Hasta</label>
          <input
            id="hasta"
            name="hasta"
            type="date"
            defaultValue={formatoFechaInput(hasta)}
            className="rounded-md border border-black/15 px-3 py-2 dark:border-white/20 dark:bg-black"
          />
        </div>
        <button
          type="submit"
          className="rounded-full bg-foreground px-5 py-2 text-background"
        >
          Filtrar
        </button>
      </form>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-md border border-black/10 p-4 dark:border-white/10">
          <p className="text-xs text-zinc-500">Comprado (periodo)</p>
          <p className="text-lg font-semibold">{resumen.compradoKg.toFixed(2)} kg</p>
          <p className="text-xs text-zinc-500">${resumen.compradoImporte.toFixed(2)}</p>
        </div>
        <div className="rounded-md border border-black/10 p-4 dark:border-white/10">
          <p className="text-xs text-zinc-500">Vendido (periodo)</p>
          <p className="text-lg font-semibold">{resumen.vendidoKg.toFixed(2)} kg</p>
          <p className="text-xs text-zinc-500">${resumen.vendidoImporte.toFixed(2)}</p>
        </div>
        <div className="rounded-md border border-black/10 p-4 dark:border-white/10">
          <p className="text-xs text-zinc-500">Ventas pendientes de aprobación</p>
          <p className="text-lg font-semibold">{resumen.pendientesAprobacion}</p>
        </div>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <p className="font-medium">Inventario por artículo / ubicación</p>
          <div className="flex gap-3 text-sm">
            <a href="/api/exports/compras" className="underline">
              Exportar compras
            </a>
            <a href="/api/exports/ventas" className="underline">
              Exportar ventas
            </a>
            <a href="/api/exports/inventario" className="underline">
              Exportar inventario
            </a>
          </div>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-black/10 text-left dark:border-white/10">
              <th className="py-2 pr-4 font-medium">Ubicación</th>
              <th className="py-2 pr-4 font-medium">Artículo</th>
              <th className="py-2 pr-4 font-medium">Comprado (kg)</th>
              <th className="py-2 pr-4 font-medium">Vendido (kg)</th>
              <th className="py-2 pr-4 font-medium">Disponible (kg)</th>
            </tr>
          </thead>
          <tbody>
            {inventario.map((i) => (
              <tr
                key={`${i.ubicacion}-${i.articulo}`}
                className="border-b border-black/5 dark:border-white/5"
              >
                <td className="py-2 pr-4">{i.ubicacion}</td>
                <td className="py-2 pr-4">{i.articulo}</td>
                <td className="py-2 pr-4">{i.comprado.toFixed(2)}</td>
                <td className="py-2 pr-4">{i.vendido.toFixed(2)}</td>
                <td className="py-2 pr-4">{i.disponible.toFixed(2)}</td>
              </tr>
            ))}
            {inventario.length === 0 && (
              <tr>
                <td colSpan={5} className="py-6 text-center text-zinc-500">
                  Sin datos todavía.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
