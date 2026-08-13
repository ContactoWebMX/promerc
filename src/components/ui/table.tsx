export function TableWrapper({ children }: { children: React.ReactNode }) {
  return (
    <div className="w-full min-w-0 rounded-lg border border-border bg-surface sm:overflow-x-auto">
      <table className="w-full text-sm sm:min-w-[640px]">{children}</table>
    </div>
  );
}

// Debajo de sm, la tabla se convierte en una lista de tarjetas apiladas: cada
// <tr> es una tarjeta y cada <td> muestra su encabezado como etiqueta antes
// del valor (vía data-label + ::before), en vez de forzar scroll horizontal
// para ver columnas que no caben en una pantalla angosta.
export const theadClass = "max-sm:hidden";

export const thClass =
  "px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted";

export const tdClass =
  "px-4 py-3 max-sm:flex max-sm:items-center max-sm:justify-between max-sm:gap-3 max-sm:py-2 max-sm:before:text-xs max-sm:before:font-medium max-sm:before:uppercase max-sm:before:tracking-wide max-sm:before:text-muted max-sm:before:content-[attr(data-label)]";

export const trClass =
  "border-t border-border hover:bg-background/60 max-sm:block max-sm:border-t-0 max-sm:border-b max-sm:px-4 max-sm:py-1 max-sm:first:border-t";
