import Link from "next/link";
import { buttonClass } from "@/components/ui/button";

export function ListPagination({
  pagina,
  totalPaginas,
  total,
  etiqueta,
  basePath,
  params,
}: {
  pagina: number;
  totalPaginas: number;
  total: number;
  etiqueta: string;
  basePath: string;
  params: URLSearchParams;
}) {
  if (totalPaginas <= 1) return null;

  function hrefConPagina(p: number) {
    const sp = new URLSearchParams(params);
    sp.set("page", p.toString());
    return `${basePath}?${sp.toString()}`;
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted">
      <span>
        Página {pagina} de {totalPaginas} · {total} {etiqueta}
      </span>
      <div className="flex gap-2">
        {pagina > 1 && (
          <Link href={hrefConPagina(pagina - 1)} className={buttonClass("secondary", "sm")}>
            Anterior
          </Link>
        )}
        {pagina < totalPaginas && (
          <Link href={hrefConPagina(pagina + 1)} className={buttonClass("secondary", "sm")}>
            Siguiente
          </Link>
        )}
      </div>
    </div>
  );
}
