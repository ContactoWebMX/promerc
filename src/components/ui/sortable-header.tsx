import Link from "next/link";
import { thClass } from "@/components/ui/table";

// Encabezado de columna clickeable: cambia el orden (o invierte la
// dirección si ya es el criterio activo) preservando cualquier otro filtro
// ya presente en la URL (fecha, ubicación, tamaño de página...) — por eso
// recibe los searchParams completos ya resueltos, no solo sort/dir.
export function SortableHeader({
  label,
  field,
  currentSort,
  currentDir,
  basePath,
  params,
}: {
  label: string;
  field: string;
  currentSort: string;
  currentDir: "asc" | "desc";
  basePath: string;
  params: URLSearchParams;
}) {
  const activo = currentSort === field;
  const siguienteDir = activo && currentDir === "asc" ? "desc" : "asc";
  const sp = new URLSearchParams(params);
  sp.set("sort", field);
  sp.set("dir", siguienteDir);
  sp.delete("page");

  return (
    <th className={thClass}>
      <Link
        href={`${basePath}?${sp.toString()}`}
        className="inline-flex min-h-11 items-center gap-1 hover:text-foreground"
      >
        {label}
        <span aria-hidden className={activo ? "text-foreground" : "text-transparent"}>
          {currentDir === "asc" ? "▲" : "▼"}
        </span>
      </Link>
    </th>
  );
}
