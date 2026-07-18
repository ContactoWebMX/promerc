import { getCurrentUser } from "@/lib/auth/dal";
import { inventarioPorArticuloUbicacion } from "@/lib/reportes";
import { buildWorkbook } from "@/lib/export/excel";

export async function GET() {
  await getCurrentUser();

  const inventario = await inventarioPorArticuloUbicacion();

  const rows = inventario.map((i) => ({
    Ubicacion: i.ubicacion,
    Articulo: i.articulo,
    Comprado_kg: i.comprado,
    Vendido_kg: i.vendido,
    Disponible_kg: i.disponible,
  }));

  const buffer = buildWorkbook([{ name: "Inventario", rows }]);
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="inventario.xlsx"',
    },
  });
}
