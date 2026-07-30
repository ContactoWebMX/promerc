import Link from "next/link";
import type { TrazaCadena } from "@/lib/traza";

const ESTADO_LABELS: Record<string, string> = {
  TARA_CAPTURADA: "Pendiente de salida",
  CARGA_REGISTRADA: "Cargado — pendiente de báscula",
  COMPLETO: "Completo",
  ANULADO: "Anulado",
  ABIERTA: "Abierta",
  CERRADA: "Cerrada",
  CANCELADA: "Cancelada",
  ABIERTO: "Abierto",
  CERRADO: "Cerrado",
  BORRADOR: "Falta reportar peso",
  PENDIENTE_APROBACION: "Pendiente de aprobación",
};

function Paso({
  label,
  titulo,
  subtitulo,
  href,
  activo,
}: {
  label: string;
  titulo: string | null;
  subtitulo?: string;
  href: string | null;
  activo: boolean;
}) {
  const clases = `flex min-w-36 flex-col gap-0.5 rounded-md border px-3 py-2 text-sm transition-colors ${
    activo
      ? "border-primary bg-primary/5"
      : titulo
        ? "border-border bg-surface hover:bg-background"
        : "border-dashed border-border bg-background text-muted"
  }`;
  const contenido = (
    <>
      <span className="text-xs font-medium uppercase tracking-wide text-muted">{label}</span>
      <span className="font-medium">{titulo ?? "Pendiente"}</span>
      {subtitulo && <span className="text-xs text-muted">{subtitulo}</span>}
    </>
  );
  return href ? (
    <Link href={href} className={clases}>
      {contenido}
    </Link>
  ) : (
    <div className={clases}>{contenido}</div>
  );
}

export function Traza({
  traza,
  actual,
}: {
  traza: TrazaCadena;
  actual: { tipo: "pesaje" | "compra" | "lote" | "venta"; id: number };
}) {
  const { pesaje, compra, lote, ventas } = traza;
  const esActual = (tipo: string, id: number) => actual.tipo === tipo && actual.id === id;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Paso
        label="Pesaje"
        titulo={pesaje?.folioTicket ?? null}
        subtitulo={pesaje ? ESTADO_LABELS[pesaje.estado] : undefined}
        href={pesaje && !esActual("pesaje", pesaje.id) ? `/pesajes/${pesaje.id}` : null}
        activo={pesaje ? esActual("pesaje", pesaje.id) : false}
      />
      <span aria-hidden className="text-muted">
        →
      </span>
      <Paso
        label="Lote"
        titulo={lote?.folio ?? null}
        subtitulo={lote ? ESTADO_LABELS[lote.estado] : undefined}
        href={lote && !esActual("lote", lote.id) ? `/lotes/${lote.id}` : null}
        activo={lote ? esActual("lote", lote.id) : false}
      />
      <span aria-hidden className="text-muted">
        →
      </span>
      <Paso
        label="Compra"
        titulo={compra ? `#${compra.id}` : null}
        href={compra && !esActual("compra", compra.id) ? `/compras/${compra.id}` : null}
        activo={compra ? esActual("compra", compra.id) : false}
      />
      <span aria-hidden className="text-muted">
        →
      </span>
      {ventas.length <= 1 ? (
        <Paso
          label="Venta"
          titulo={ventas[0]?.cliente.nombre ?? null}
          subtitulo={ventas[0] ? ESTADO_LABELS[ventas[0].estado] : undefined}
          href={ventas[0] && !esActual("venta", ventas[0].id) ? `/ventas/${ventas[0].id}` : null}
          activo={ventas[0] ? esActual("venta", ventas[0].id) : false}
        />
      ) : (
        <div className="flex min-w-36 flex-col gap-1 rounded-md border border-border bg-surface px-3 py-2 text-sm">
          <span className="text-xs font-medium uppercase tracking-wide text-muted">
            Venta ({ventas.length})
          </span>
          <div className="flex flex-wrap gap-x-2 gap-y-0.5">
            {ventas.map((v) =>
              esActual("venta", v.id) ? (
                <span key={v.id} className="text-xs font-semibold text-primary">
                  {v.cliente.nombre}
                </span>
              ) : (
                <Link
                  key={v.id}
                  href={`/ventas/${v.id}`}
                  className="text-xs text-primary hover:underline"
                >
                  {v.cliente.nombre}
                </Link>
              ),
            )}
          </div>
        </div>
      )}
    </div>
  );
}
