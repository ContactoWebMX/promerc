import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/dal";
import { prisma } from "@/lib/db";
import { CatalogForm } from "@/components/catalog-form";
import { ActionDialog } from "@/components/ui/action-dialog";
import { Card, PageHeader } from "@/components/ui/card";
import { buttonClass } from "@/components/ui/button";
import {
  guardarToleranciaGlobal,
  guardarToleranciaArticulo,
  eliminarToleranciaArticulo,
} from "./actions";

const UMBRAL_RESPALDO_PCT = 3;

export default async function ToleranciaPage() {
  const usuario = await getCurrentUser();
  if (usuario.role !== "ADMIN") redirect("/catalogos");

  const [global, overrides, articulos] = await Promise.all([
    prisma.toleranciaConfig.findFirst({ where: { articuloId: null } }),
    prisma.toleranciaConfig.findMany({
      where: { articuloId: { not: null } },
      include: { articulo: true },
      orderBy: { articulo: { nombre: "asc" } },
    }),
    prisma.articulo.findMany({ where: { activo: true }, orderBy: { nombre: "asc" } }),
  ]);

  const articulosSinOverride = articulos.filter(
    (a) => !overrides.some((o) => o.articuloId === a.id),
  );

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Tolerancia" />

      <Card className="max-w-md">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="font-semibold">Umbral global</h2>
            <p className="mt-1 text-sm text-muted">
              Se aplica a cualquier artículo sin excepción propia.
            </p>
            <p className="mt-2 text-2xl font-semibold">
              {global ? `${global.porcentajeUmbral.toString()}%` : `${UMBRAL_RESPALDO_PCT}%`}
            </p>
            {!global && (
              <p className="text-xs text-muted">Sin configurar — se usa {UMBRAL_RESPALDO_PCT}% por defecto.</p>
            )}
          </div>
          <ActionDialog label="Editar" title="Editar umbral global">
            <CatalogForm
              action={guardarToleranciaGlobal}
              submitLabel="Guardar"
              defaultValues={{
                porcentajeUmbral: global?.porcentajeUmbral.toString() ?? String(UMBRAL_RESPALDO_PCT),
              }}
              fields={[
                {
                  name: "porcentajeUmbral",
                  label: "Umbral (%)",
                  type: "number",
                  required: true,
                  min: 0,
                  step: 0.01,
                },
              ]}
            />
          </ActionDialog>
        </div>
      </Card>

      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold">Excepciones por artículo</h2>
          {articulosSinOverride.length > 0 && (
            <ActionDialog label="Agregar excepción" title="Agregar excepción por artículo">
              <CatalogForm
                action={guardarToleranciaArticulo}
                submitLabel="Guardar"
                fields={[
                  {
                    name: "articuloId",
                    label: "Artículo",
                    type: "select",
                    required: true,
                    options: articulosSinOverride.map((a) => ({
                      value: String(a.id),
                      label: a.nombre,
                    })),
                  },
                  {
                    name: "porcentajeUmbral",
                    label: "Umbral (%)",
                    type: "number",
                    required: true,
                    min: 0,
                    step: 0.01,
                  },
                ]}
              />
            </ActionDialog>
          )}
        </div>

        {overrides.length === 0 ? (
          <p className="text-sm text-muted">Sin excepciones — todos los artículos usan el umbral global.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead className="bg-surface text-left text-muted">
                <tr>
                  <th className="px-4 py-2">Artículo</th>
                  <th className="px-4 py-2">Umbral</th>
                  <th className="px-4 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {overrides.map((o) => (
                  <tr key={o.id} className="border-t border-border">
                    <td className="px-4 py-2">{o.articulo?.nombre}</td>
                    <td className="px-4 py-2">{o.porcentajeUmbral.toString()}%</td>
                    <td className="px-4 py-2">
                      <div className="flex justify-end gap-2">
                        <ActionDialog label="Editar" title={`Editar umbral — ${o.articulo?.nombre}`}>
                          <CatalogForm
                            action={guardarToleranciaArticulo}
                            submitLabel="Guardar"
                            hiddenFields={{ articuloId: o.articuloId! }}
                            defaultValues={{ porcentajeUmbral: o.porcentajeUmbral.toString() }}
                            fields={[
                              {
                                name: "porcentajeUmbral",
                                label: "Umbral (%)",
                                type: "number",
                                required: true,
                                min: 0,
                                step: 0.01,
                              },
                            ]}
                          />
                        </ActionDialog>
                        <form action={eliminarToleranciaArticulo}>
                          <input type="hidden" name="id" value={o.id} />
                          <button type="submit" className={buttonClass("danger", "sm")}>
                            Eliminar
                          </button>
                        </form>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
