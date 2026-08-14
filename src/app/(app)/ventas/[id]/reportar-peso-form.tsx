"use client";

import { useActionState, useState } from "react";
import { Card } from "@/components/ui/card";
import { buttonClass } from "@/components/ui/button";
import { inputClass, labelClass } from "@/components/ui/field";
import { FotoInput } from "@/components/ui/foto-input";
import { useFallaRed } from "@/lib/use-falla-red";
import { reportarPesoVenta, type VentaFormState } from "./actions";

const MOTIVOS_SUGERIDOS = ["Material mojado", "Error de báscula del cliente", "Merma en tránsito"];

export function ReportarPesoForm({
  ventaId,
  pesoVendidoKg,
  umbralPct,
  fechaHoy,
}: {
  ventaId: number;
  pesoVendidoKg: string;
  umbralPct: number;
  fechaHoy: string;
}) {
  const [state, action, pending] = useActionState<VentaFormState, FormData>(
    reportarPesoVenta,
    undefined,
  );
  const fallaRed = useFallaRed(pending, state);
  const [pesoReportado, setPesoReportado] = useState("");

  const pesoVendido = Number(pesoVendidoKg);
  const pesoReportadoNum = Number(pesoReportado);
  const hayDiferencia = pesoReportado !== "" && !Number.isNaN(pesoReportadoNum);
  const diferenciaKg = hayDiferencia ? Number((pesoVendido - pesoReportadoNum).toFixed(2)) : 0;
  const diferenciaPct = hayDiferencia && pesoVendido > 0 ? Math.abs(diferenciaKg / pesoVendido) * 100 : 0;
  const requiereEvidencia = hayDiferencia && diferenciaKg !== 0;

  return (
    <Card className="max-w-md">
      <form action={action} className="flex flex-col gap-4">
        <input type="hidden" name="id" value={ventaId} />

        <div>
          <h2 className="font-semibold">Reportar peso de entrega</h2>
          <p className="mt-1 text-sm text-muted">
            Peso vendido (del lote): <strong className="text-foreground">{pesoVendidoKg} kg</strong>.
            Reporta el peso que informó el cliente en su báscula. Tolerancia vigente: {umbralPct}%.
          </p>
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="pesoReportadoEn" className={labelClass}>
            Fecha en que se reportó el peso
          </label>
          <input
            id="pesoReportadoEn"
            name="pesoReportadoEn"
            type="date"
            defaultValue={fechaHoy}
            required
            className={inputClass}
          />
          <p className="text-xs text-muted">
            Precargada con hoy — ajústala si el cliente reportó el peso en otra fecha.
          </p>
          {state?.errors?.pesoReportadoEn && (
            <p className="text-sm text-danger">{state.errors.pesoReportadoEn[0]}</p>
          )}
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="pesoReportadoClienteKg" className={labelClass}>
            Peso reportado por el cliente (kg)
          </label>
          <input
            id="pesoReportadoClienteKg"
            name="pesoReportadoClienteKg"
            type="number"
            inputMode="decimal"
            min={0}
            step={0.01}
            required
            value={pesoReportado}
            onChange={(e) => setPesoReportado(e.target.value)}
            className={inputClass}
          />
          {state?.errors?.pesoReportadoClienteKg && (
            <p className="text-sm text-danger">
              {state.errors.pesoReportadoClienteKg[0]}
            </p>
          )}
        </div>

        {requiereEvidencia && (
          <p
            className={`rounded-md border p-3 text-sm ${
              diferenciaKg > 0
                ? "border-danger/40 bg-danger/10 text-danger"
                : "border-primary/40 bg-primary/10 text-primary"
            }`}
          >
            {diferenciaKg > 0 ? "Merma" : "Sobrante"} de {Math.abs(diferenciaKg)} kg (
            {diferenciaPct.toFixed(1)}%
            {diferenciaPct > umbralPct ? " — excede la tolerancia" : ""}). Debido a que se ha
            reportado diferencia, es necesario adjuntar evidencia.
          </p>
        )}

        <div className="flex flex-col gap-1">
          <label htmlFor="motivoDiferencia" className={labelClass}>
            Motivo de la diferencia{requiereEvidencia ? "" : " (si aplica)"}
          </label>
          <input
            id="motivoDiferencia"
            name="motivoDiferencia"
            list="motivos-diferencia"
            placeholder="ej. material mojado"
            required={requiereEvidencia}
            onInput={(e) => {
              e.currentTarget.value = e.currentTarget.value.toUpperCase();
            }}
            className={inputClass}
          />
          <datalist id="motivos-diferencia">
            {MOTIVOS_SUGERIDOS.map((motivo) => (
              <option key={motivo} value={motivo} />
            ))}
          </datalist>
          {state?.errors?.motivoDiferencia && (
            <p className="text-sm text-danger">
              {state.errors.motivoDiferencia[0]}
            </p>
          )}
        </div>

        <FotoInput
          id="comprobante"
          name="comprobante"
          label="Foto del comprobante de peso del cliente"
          required={requiereEvidencia}
          error={state?.errors?.comprobante?.[0]}
        />

        {state?.message && <p className="text-sm text-danger">{state.message}</p>}

        {fallaRed && (
          <p className="rounded-md border border-danger/40 bg-danger/10 p-3 text-sm text-danger">
            No se pudo guardar — parece que se perdió la conexión. Tus datos
            siguen aquí, solo vuelve a intentar cuando tengas señal.
          </p>
        )}

        <button type="submit" disabled={pending} className={buttonClass("primary")}>
          {pending ? "Guardando..." : "Reportar peso"}
        </button>
      </form>
    </Card>
  );
}
