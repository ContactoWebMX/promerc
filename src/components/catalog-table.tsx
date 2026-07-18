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
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-black/10 text-left dark:border-white/10">
          {columns.map((c) => (
            <th key={c.header} className="py-2 pr-4 font-medium">
              {c.header}
            </th>
          ))}
          <th className="py-2 pr-4 font-medium">Estado</th>
          <th className="py-2" />
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.id} className="border-b border-black/5 dark:border-white/5">
            {columns.map((c) => (
              <td key={c.header} className="py-2 pr-4">
                {c.cell(row)}
              </td>
            ))}
            <td className="py-2 pr-4">{row.activo ? "Activo" : "Inactivo"}</td>
            <td className="py-2">
              <div className="flex items-center gap-3">
                <a href={`${editBasePath}/${row.id}`} className="underline">
                  Editar
                </a>
                <form action={toggleAction}>
                  <input type="hidden" name="id" value={row.id} />
                  <input
                    type="hidden"
                    name="activo"
                    value={(!row.activo).toString()}
                  />
                  <button type="submit" className="underline">
                    {row.activo ? "Desactivar" : "Activar"}
                  </button>
                </form>
              </div>
            </td>
          </tr>
        ))}
        {rows.length === 0 && (
          <tr>
            <td
              colSpan={columns.length + 2}
              className="py-6 text-center text-zinc-500"
            >
              Sin registros todavía.
            </td>
          </tr>
        )}
      </tbody>
    </table>
  );
}
