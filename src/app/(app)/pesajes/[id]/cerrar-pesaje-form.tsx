"use client";

import { useActionState } from "react";
import { SignaturePad } from "@/components/signature-pad";
import { cerrarPesaje, type CerrarPesajeState } from "./actions";

export function CerrarPesajeForm({
  pesajeId,
  taraKg,
  unidadesEmpaque,
}: {
  pesajeId: number;
  taraKg: string;
  unidadesEmpaque: { id: number; nombre: string }[];
}) {
  const [state, action, pending] = useActionState<CerrarPesajeState, FormData>(
    cerrarPesaje,
    undefined,
  );

  return (
    <form action={action} className="flex w-full max-w-md flex-col gap-5">
      <input type="hidden" name="id" value={pesajeId} />

      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        Tara registrada: <strong>{taraKg} kg</strong>. El neto se calcula
        automáticamente al capturar el peso cargado.
      </p>

      <div className="flex flex-col gap-1">
        <label htmlFor="grossKg" className="text-sm font-medium">
          Peso cargado (kg)
        </label>
        <input
          id="grossKg"
          name="grossKg"
          type="number"
          min={0}
          step={0.01}
          required
          className="rounded-md border border-black/15 px-3 py-2 dark:border-white/20 dark:bg-black"
        />
        {state?.errors?.grossKg && (
          <p className="text-sm text-red-600">{state.errors.grossKg[0]}</p>
        )}
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="pesadorNombre" className="text-sm font-medium">
          Nombre del pesador
        </label>
        <input
          id="pesadorNombre"
          name="pesadorNombre"
          required
          className="rounded-md border border-black/15 px-3 py-2 dark:border-white/20 dark:bg-black"
        />
        {state?.errors?.pesadorNombre && (
          <p className="text-sm text-red-600">{state.errors.pesadorNombre[0]}</p>
        )}
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="clienteDestinoReferencia" className="text-sm font-medium">
          Cliente destino (referencia del ticket)
        </label>
        <input
          id="clienteDestinoReferencia"
          name="clienteDestinoReferencia"
          className="rounded-md border border-black/15 px-3 py-2 dark:border-white/20 dark:bg-black"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="observaciones" className="text-sm font-medium">
          Observaciones
        </label>
        <input
          id="observaciones"
          name="observaciones"
          className="rounded-md border border-black/15 px-3 py-2 dark:border-white/20 dark:bg-black"
        />
      </div>

      {unidadesEmpaque.length > 0 && (
        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium">Pacas</span>
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
                className="w-24 rounded-md border border-black/15 px-3 py-2 dark:border-white/20 dark:bg-black"
              />
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-col gap-1">
        <label htmlFor="foto" className="text-sm font-medium">
          Foto del ticket de báscula
        </label>
        <input
          id="foto"
          name="foto"
          type="file"
          accept="image/*"
          capture="environment"
          required
          className="text-sm"
        />
        {state?.errors?.foto && (
          <p className="text-sm text-red-600">{state.errors.foto[0]}</p>
        )}
      </div>

      <div className="flex flex-col gap-2 rounded-md border border-black/10 p-3 dark:border-white/10">
        <span className="text-sm font-semibold">Firma de salida (transportista)</span>
        <label htmlFor="firmaSalidaNombre" className="text-sm">
          Nombre de quien entrega
        </label>
        <input
          id="firmaSalidaNombre"
          name="firmaSalidaNombre"
          required
          className="rounded-md border border-black/15 px-3 py-2 dark:border-white/20 dark:bg-black"
        />
        {state?.errors?.firmaSalidaNombre && (
          <p className="text-sm text-red-600">{state.errors.firmaSalidaNombre[0]}</p>
        )}
        <SignaturePad name="firmaSalidaImagen" label="Firma" />
        {state?.errors?.firmaSalidaImagen && (
          <p className="text-sm text-red-600">{state.errors.firmaSalidaImagen[0]}</p>
        )}
      </div>

      <div className="flex flex-col gap-2 rounded-md border border-black/10 p-3 dark:border-white/10">
        <span className="text-sm font-semibold">
          Validación del supervisor (revisar ambos lados de la plataforma)
        </span>
        <label htmlFor="firmaSupervisorNombre" className="text-sm">
          Nombre del supervisor
        </label>
        <input
          id="firmaSupervisorNombre"
          name="firmaSupervisorNombre"
          required
          className="rounded-md border border-black/15 px-3 py-2 dark:border-white/20 dark:bg-black"
        />
        {state?.errors?.firmaSupervisorNombre && (
          <p className="text-sm text-red-600">
            {state.errors.firmaSupervisorNombre[0]}
          </p>
        )}
        <SignaturePad name="firmaSupervisorImagen" label="Firma" />
        {state?.errors?.firmaSupervisorImagen && (
          <p className="text-sm text-red-600">
            {state.errors.firmaSupervisorImagen[0]}
          </p>
        )}
      </div>

      {state?.message && <p className="text-sm text-red-600">{state.message}</p>}

      <button
        type="submit"
        disabled={pending}
        className="rounded-full bg-foreground px-5 py-2 text-background disabled:opacity-60"
      >
        {pending ? "Guardando..." : "Cerrar pesaje"}
      </button>
    </form>
  );
}
