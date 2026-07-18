import "server-only";
import * as XLSX from "xlsx";

export function buildWorkbook(
  sheets: { name: string; rows: Record<string, unknown>[] }[],
): Buffer {
  const workbook = XLSX.utils.book_new();
  for (const sheet of sheets) {
    const worksheet = XLSX.utils.json_to_sheet(sheet.rows);
    // Excel limita el nombre de hoja a 31 caracteres.
    XLSX.utils.book_append_sheet(workbook, worksheet, sheet.name.slice(0, 31));
  }
  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;
}
