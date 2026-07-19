"use client";

import { useActionState } from "react";
import { Card } from "@/components/ui/card";
import { buttonClass } from "@/components/ui/button";
import { inputClass, labelClass, fileInputClass } from "@/components/ui/field";
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
    <Card className="max-w-md">
      <form action={action} className="flex flex-col gap-4">
        <input type="hidden" name="id" value={ventaId} />

        <div>
          <h2 className="font-semibold">Reportar peso de entrega</h2>
          <p className="mt-1 text-sm text-muted">
            Peso vendido (del lote): <strong className="text-foreground">{pesoVendidoKg} kg</strong>.
            Reporta el peso que informó el cliente en su báscula.
          </p>
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="pesoReportadoClienteKg" className={labelClass}>
            Peso reportado por el cliente (kg)
          </label>
          <input
            id="pesoReportadoClienteKg"
            name="pesoReportadoClienteKg"
            type="number"
            min={0}
            step={0.01}
            required
            className={inputClass}
          />
          {state?.errors?.pesoReportadoClienteKg && (
            <p className="text-sm text-danger">
              {state.errors.pesoReportadoClienteKg[0]}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="penalizacionKg" className={labelClass}>
            Penalización (kg) — opcional
          </label>
          <input
            id="penalizacionKg"
            name="penalizacionKg"
            type="number"
            min={0}
            step={0.01}
            defaultValue={0}
            className={inputClass}
          />
          {state?.errors?.penalizacionKg && (
            <p className="text-sm text-danger">{state.errors.penalizacionKg[0]}</p>
          )}
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="penalizacionMotivo" className={labelClass}>
            Motivo de la penalización (obligatorio si aplica)
          </label>
          <input
            id="penalizacionMotivo"
            name="penalizacionMotivo"
            placeholder="ej. material mojado"
            className={inputClass}
          />
          {state?.errors?.penalizacionMotivo && (
            <p className="text-sm text-danger">
              {state.errors.penalizacionMotivo[0]}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="comprobante" className={labelClass}>
            Foto del comprobante de peso del cliente
          </label>
          <input
            id="comprobante"
            name="comprobante"
            type="file"
            accept="image/*"
            capture="environment"
            required
            className={fileInputClass}
          />
          {state?.errors?.comprobante && (
            <p className="text-sm text-danger">{state.errors.comprobante[0]}</p>
          )}
        </div>

        {state?.message && <p className="text-sm text-danger">{state.message}</p>}

        <button type="submit" disabled={pending} className={buttonClass("primary")}>
          {pending ? "Guardando..." : "Reportar peso"}
        </button>
      </form>
    </Card>
  );
}
