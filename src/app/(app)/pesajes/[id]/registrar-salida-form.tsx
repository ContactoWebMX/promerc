"use client";

import { useActionState } from "react";
import { SignaturePad } from "@/components/signature-pad";
import { Card } from "@/components/ui/card";
import { buttonClass } from "@/components/ui/button";
import { inputClass, labelClass } from "@/components/ui/field";
import { ConfirmSubmitButton } from "@/components/ui/confirm-submit-button";
import { FormSection } from "@/components/ui/form-section";
import { useFallaRed } from "@/lib/use-falla-red";
import { registrarSalida, type CerrarPesajeState } from "./actions";

// Paso 1 del cierre: se llena al cargar el camión, antes de pasar por
// báscula — todavía no se conoce el peso, por eso no pide foto de ticket.
export function RegistrarSalidaForm({
  pesajeId,
  unidadesEmpaque,
  articulos,
}: {
  pesajeId: number;
  unidadesEmpaque: { id: number; nombre: string }[];
  articulos: { id: number; nombre: string }[];
}) {
  const [state, action, pending] = useActionState<CerrarPesajeState, FormData>(
    registrarSalida,
    undefined,
  );
  const fallaRed = useFallaRed(pending, state);

  return (
    <Card className="max-w-2xl">
      <form action={action} className="flex flex-col gap-5">
        <input type="hidden" name="id" value={pesajeId} />

        <div>
          <h2 className="font-semibold">Registrar salida</h2>
          <p className="mt-1 text-sm text-muted">
            Lo que se lleva el camión — el peso se captura después, al pasar
            por báscula.
          </p>
        </div>

        <FormSection title="Carga">
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="flex flex-1 flex-col gap-1">
              <label htmlFor="articuloId" className={labelClass}>
                Artículo
              </label>
              <select id="articuloId" name="articuloId" required className={inputClass}>
                <option value="">—</option>
                {articulos.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.nombre}
                  </option>
                ))}
              </select>
              {state?.errors?.articuloId && (
                <p className="text-sm text-danger">{state.errors.articuloId[0]}</p>
              )}
            </div>

            <div className="flex flex-1 flex-col gap-1">
              <label htmlFor="clienteDestinoReferencia" className={labelClass}>
                Destino (referencia)
              </label>
              <input
                id="clienteDestinoReferencia"
                name="clienteDestinoReferencia"
                className={inputClass}
              />
            </div>
          </div>

          {unidadesEmpaque.length > 0 && (
            <div className="flex flex-col gap-2">
              <span className={labelClass}>Pacas</span>
              {unidadesEmpaque.map((u) => (
                <div key={u.id} className="flex items-center gap-2">
                  <label htmlFor={`paca-${u.id}`} className="w-32 text-sm">
                    {u.nombre}
                  </label>
                  <input
                    id={`paca-${u.id}`}
                    name={`paca-${u.id}`}
                    type="number"
                    min={0}
                    defaultValue={0}
                    className={`w-24 ${inputClass}`}
                  />
                </div>
              ))}
            </div>
          )}
        </FormSection>

        <FormSection title="Autorización de salida">
          <div className="flex flex-col gap-2">
            <label htmlFor="firmaSalidaNombre" className="text-sm">
              Nombre de quien autoriza la salida
            </label>
            <input
              id="firmaSalidaNombre"
              name="firmaSalidaNombre"
              required
              className={inputClass}
            />
            {state?.errors?.firmaSalidaNombre && (
              <p className="text-sm text-danger">{state.errors.firmaSalidaNombre[0]}</p>
            )}
            <SignaturePad name="firmaSalidaImagen" label="Firma" />
            {state?.errors?.firmaSalidaImagen && (
              <p className="text-sm text-danger">{state.errors.firmaSalidaImagen[0]}</p>
            )}
          </div>
        </FormSection>

        {state?.message && <p className="text-sm text-danger">{state.message}</p>}

        {fallaRed && (
          <p className="rounded-md border border-danger/40 bg-danger/10 p-3 text-sm text-danger">
            No se pudo guardar — parece que se perdió la conexión. Tus datos
            siguen aquí (incluida la firma), solo vuelve a intentar cuando
            tengas señal.
          </p>
        )}

        <ConfirmSubmitButton
          confirmMessage="¿Registrar esta salida? El camión queda pendiente de pasar por báscula para cerrar el pesaje."
          disabled={pending}
          className={buttonClass("primary")}
        >
          {pending ? "Guardando..." : "Registrar salida"}
        </ConfirmSubmitButton>
      </form>
    </Card>
  );
}
