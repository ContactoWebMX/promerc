import Link from "next/link";
import { TableWrapper, thClass, tdClass, trClass } from "@/components/ui/table";
import { buttonClass } from "@/components/ui/button";
import { ConfirmSubmitButton } from "@/components/ui/confirm-submit-button";

type Column<T> = { header: string; cell: (row: T) => React.ReactNode };

export function CatalogTable<T extends { id: number; activo: boolean }>({
  rows,
  columns,
  toggleAction,
  editBasePath,
}: {
  rows: T[];
  columns: Column<T>[];
  toggleAction: (formData: FormData) => Promise<void>;
  editBasePath: string;
}) {
  return (
    <TableWrapper>
      <thead>
        <tr>
          {columns.map((c) => (
            <th key={c.header} className={thClass}>
              {c.header}
            </th>
          ))}
          <th className={thClass}>Estado</th>
          <th className={thClass} />
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.id} className={trClass}>
            {columns.map((c) => (
              <td key={c.header} className={tdClass}>
                {c.cell(row)}
              </td>
            ))}
            <td className={tdClass}>
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                  row.activo
                    ? "bg-primary/10 text-primary"
                    : "bg-muted/15 text-muted"
                }`}
              >
                {row.activo ? "Activo" : "Inactivo"}
              </span>
            </td>
            <td className={tdClass}>
              <div className="flex items-center gap-4">
                <Link href={`${editBasePath}/${row.id}`} className={buttonClass("link")}>
                  Editar
                </Link>
                <form action={toggleAction}>
                  <input type="hidden" name="id" value={row.id} />
                  <input
                    type="hidden"
                    name="activo"
                    value={(!row.activo).toString()}
                  />
                  {row.activo ? (
                    <ConfirmSubmitButton
                      confirmMessage="¿Desactivar este registro?"
                      className={buttonClass("link")}
                    >
                      Desactivar
                    </ConfirmSubmitButton>
                  ) : (
                    <button type="submit" className={buttonClass("link")}>
                      Activar
                    </button>
                  )}
                </form>
              </div>
            </td>
          </tr>
        ))}
        {rows.length === 0 && (
          <tr>
            <td colSpan={columns.length + 2} className={`${tdClass} text-center text-muted`}>
              Sin registros todavía.
            </td>
          </tr>
        )}
      </tbody>
    </TableWrapper>
  );
}
