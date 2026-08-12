import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/dal";
import { inventarioPorArticuloUbicacion, resumenPeriodo } from "@/lib/reportes";
import { Card, PageHeader } from "@/components/ui/card";
import { buttonClass } from "@/components/ui/button";
import { inputClass, labelClass } from "@/components/ui/field";
import { TableWrapper, thClass, tdClass, trClass } from "@/components/ui/table";
import { resolverRangoFecha } from "@/lib/rango-fecha";

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ desde?: string; hasta?: string }>;
}) {
  const usuario = await getCurrentUser();

  if (usuario.role === "CLIENTE") {
    return (
      <Card className="max-w-md">
        <h1 className="text-lg font-semibold">Bienvenido, {usuario.nombre}</h1>
        <p className="mt-1 text-sm text-muted">
          El portal de cliente todavía no está disponible en esta fase.
        </p>
      </Card>
    );
  }

  const params = await searchParams;
  const { desde, hasta, desdeStr, hastaStr } = resolverRangoFecha(params.desde, params.hasta);

  const soloMiUbicacion = usuario.role !== "ADMIN" && usuario.role !== "SUPERVISOR";
  const ubicacionId = soloMiUbicacion ? (usuario.ubicacionId ?? -1) : undefined;
  const puedeVerCompraVenta = usuario.role === "ADMIN" || usuario.role === "SUPERVISOR";

  const accesosRapidos = [
    { href: "/pesajes/nuevo", label: "Nuevo pesaje" },
    ...(puedeVerCompraVenta ? [{ href: "/ventas/nuevo", label: "Nueva venta" }] : []),
    { href: "/lotes", label: "Ver lotes" },
  ];

  const [resumen, inventario] = await Promise.all([
    resumenPeriodo(desde, hasta, ubicacionId),
    inventarioPorArticuloUbicacion(ubicacionId),
  ]);

  const exportQuery = `?desde=${desdeStr}&hasta=${hastaStr}`;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={`Hola, ${usuario.nombre}`}
        action={
          <div className="flex flex-wrap gap-2">
            {accesosRapidos.map((a) => (
              <Link key={a.href} href={a.href} className={buttonClass("primary", "sm")}>
                {a.label}
              </Link>
            ))}
          </div>
        }
      />

      <form method="get" className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <label htmlFor="desde" className={labelClass}>
            Desde
          </label>
          <input
            id="desde"
            name="desde"
            type="date"
            defaultValue={desdeStr}
            className={inputClass}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="hasta" className={labelClass}>
            Hasta
          </label>
          <input
            id="hasta"
            name="hasta"
            type="date"
            defaultValue={hastaStr}
            className={inputClass}
          />
        </div>
        <button type="submit" className={buttonClass("secondary")}>
          Filtrar
        </button>
      </form>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <p className="text-xs font-medium uppercase tracking-wide text-muted">
            Comprado (periodo)
          </p>
          <p className="mt-1 text-2xl font-semibold">{resumen.compradoKg.toFixed(2)} kg</p>
          <p className="text-sm text-muted">${resumen.compradoImporte.toFixed(2)}</p>
        </Card>
        <Card>
          <p className="text-xs font-medium uppercase tracking-wide text-muted">
            Vendido (periodo)
          </p>
          <p className="mt-1 text-2xl font-semibold">{resumen.vendidoKg.toFixed(2)} kg</p>
          <p className="text-sm text-muted">${resumen.vendidoImporte.toFixed(2)}</p>
        </Card>
        <Card>
          <p className="text-xs font-medium uppercase tracking-wide text-muted">
            Ventas pendientes de aprobación
          </p>
          <p className="mt-1 text-2xl font-semibold">{resumen.pendientesAprobacion}</p>
        </Card>
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-medium">Inventario por artículo / ubicación</h2>
          <div className="flex flex-wrap gap-4 text-sm">
            {puedeVerCompraVenta && (
              <>
                <a href={`/api/exports/compras${exportQuery}`} className={buttonClass("link")}>
                  Exportar compras del periodo
                </a>
                <a href={`/api/exports/ventas${exportQuery}`} className={buttonClass("link")}>
                  Exportar ventas del periodo
                </a>
              </>
            )}
            <a href="/api/exports/inventario" className={buttonClass("link")}>
              Exportar inventario
            </a>
          </div>
        </div>
        <TableWrapper>
          <thead>
            <tr>
              <th className={thClass}>Ubicación</th>
              <th className={thClass}>Artículo</th>
              <th className={thClass}>Comprado (kg)</th>
              <th className={thClass}>Vendido (kg)</th>
              <th className={thClass}>Disponible (kg)</th>
            </tr>
          </thead>
          <tbody>
            {inventario.map((i) => (
              <tr key={`${i.ubicacion}-${i.articulo}`} className={trClass}>
                <td className={tdClass}>{i.ubicacion}</td>
                <td className={tdClass}>{i.articulo}</td>
                <td className={tdClass}>{i.comprado.toFixed(2)}</td>
                <td className={tdClass}>{i.vendido.toFixed(2)}</td>
                <td className={tdClass}>{i.disponible.toFixed(2)}</td>
              </tr>
            ))}
            {inventario.length === 0 && (
              <tr>
                <td colSpan={5} className={`${tdClass} text-center text-muted`}>
                  Sin datos todavía.
                </td>
              </tr>
            )}
          </tbody>
        </TableWrapper>
      </div>
    </div>
  );
}
