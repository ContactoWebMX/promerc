"use client";

import { useActionState } from "react";
import { reportarPesoVenta, type VentaFormState } from "./actions";

export function ReportarPesoForm({
  ventaId,
  pesoVendidoKg,
}: {
  ventaId: number;
  pesoVendidoKg: string;
}) {
  const [state, action, pending] = useActionState<VentaFormState, FormData>(
    reportarPesoVenta,
    undefined,
  );

  return (
    <form action={action} className="flex w-full max-w-md flex-col gap-4">
      <input type="hidden" name="id" value={ventaId} />

      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        Peso vendido (del lote): <strong>{pesoVendidoKg} kg</strong>. Reporta
        el peso que informó el cliente en su báscula.
      </p>

      <div className="flex flex-col gap-1">
        <label htmlFor="pesoReportadoClienteKg" className="text-sm font-medium">
          Peso reportado por el cliente (kg)
        </label>
        <input
          id="pesoReportadoClienteKg"
          name="pesoReportadoClienteKg"
          type="number"
          min={0}
          step={0.01}
          required
          className="rounded-md border border-black/15 px-3 py-2 dark:border-white/20 dark:bg-black"
        />
        {state?.errors?.pesoReportadoClienteKg && (
          <p className="text-sm text-red-600">
            {state.errors.pesoReportadoClienteKg[0]}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="penalizacionKg" className="text-sm font-medium">
          Penalización (kg) — opcional
        </label>
        <input
          id="penalizacionKg"
          name="penalizacionKg"
          type="number"
          min={0}
          step={0.01}
          defaultValue={0}
          className="rounded-md border border-black/15 px-3 py-2 dark:border-white/20 dark:bg-black"
        />
        {state?.errors?.penalizacionKg && (
          <p className="text-sm text-red-600">{state.errors.penalizacionKg[0]}</p>
        )}
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="penalizacionMotivo" className="text-sm font-medium">
          Motivo de la penalización (obligatorio si aplica)
        </label>
        <input
          id="penalizacionMotivo"
          name="penalizacionMotivo"
          placeholder="ej. material mojado"
          className="rounded-md border border-black/15 px-3 py-2 dark:border-white/20 dark:bg-black"
        />
        {state?.errors?.penalizacionMotivo && (
          <p className="text-sm text-red-600">
            {state.errors.penalizacionMotivo[0]}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="comprobante" className="text-sm font-medium">
          Foto del comprobante de peso del cliente
        </label>
        <input
          id="comprobante"
          name="comprobante"
          type="file"
          accept="image/*"
          capture="environment"
          required
          className="text-sm"
        />
        {state?.errors?.comprobante && (
          <p className="text-sm text-red-600">{state.errors.comprobante[0]}</p>
        )}
      </div>

      {state?.message && <p className="text-sm text-red-600">{state.message}</p>}

      <button
        type="submit"
        disabled={pending}
        className="rounded-full bg-foreground px-5 py-2 text-background disabled:opacity-60"
      >
        {pending ? "Guardando..." : "Reportar peso"}
      </button>
    </form>
  );
}
