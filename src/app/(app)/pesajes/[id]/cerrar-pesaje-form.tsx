"use client";

import { useActionState, useRef, useState } from "react";
import { SignaturePad } from "@/components/signature-pad";
import { Card } from "@/components/ui/card";
import { buttonClass } from "@/components/ui/button";
import { inputClass, labelClass, fileInputClass } from "@/components/ui/field";
import { cerrarPesaje, leerTicketConIA, type CerrarPesajeState } from "./actions";

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

  const [ocrStatus, setOcrStatus] = useState<"idle" | "leyendo" | "error">("idle");
  const grossKgRef = useRef<HTMLInputElement>(null);
  const pesadorNombreRef = useRef<HTMLInputElement>(null);
  const clienteDestinoRef = useRef<HTMLInputElement>(null);
  const observacionesRef = useRef<HTMLInputElement>(null);

  async function handleFotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const foto = e.target.files?.[0];
    if (!foto) return;

    setOcrStatus("leyendo");
    const fd = new FormData();
    fd.append("foto", foto);
    const { datos, error } = await leerTicketConIA(fd);
    if (error || !datos) {
      setOcrStatus("error");
      return;
    }
    setOcrStatus("idle");
    if (datos.grossKg != null && grossKgRef.current) {
      grossKgRef.current.value = String(datos.grossKg);
    }
    if (datos.pesadorNombre && pesadorNombreRef.current) {
      pesadorNombreRef.current.value = datos.pesadorNombre;
    }
    if (datos.clienteDestinoReferencia && clienteDestinoRef.current) {
      clienteDestinoRef.current.value = datos.clienteDestinoReferencia;
    }
    if (datos.observaciones && observacionesRef.current) {
      observacionesRef.current.value = datos.observaciones;
    }
  }

  return (
    <Card className="max-w-md">
      <form action={action} className="flex flex-col gap-5">
        <input type="hidden" name="id" value={pesajeId} />

        <div>
          <h2 className="font-semibold">Cerrar pesaje</h2>
          <p className="mt-1 text-sm text-muted">
            Tara registrada: <strong className="text-foreground">{taraKg} kg</strong>.
            El neto se calcula automáticamente al capturar el peso cargado.
          </p>
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="grossKg" className={labelClass}>
            Peso cargado (kg)
          </label>
          <input
            id="grossKg"
            name="grossKg"
            type="number"
            min={0}
            step={0.01}
            required
            ref={grossKgRef}
            className={inputClass}
          />
          {state?.errors?.grossKg && (
            <p className="text-sm text-danger">{state.errors.grossKg[0]}</p>
          )}
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="pesadorNombre" className={labelClass}>
            Nombre del pesador
          </label>
          <input
            id="pesadorNombre"
            name="pesadorNombre"
            required
            ref={pesadorNombreRef}
            className={inputClass}
          />
          {state?.errors?.pesadorNombre && (
            <p className="text-sm text-danger">{state.errors.pesadorNombre[0]}</p>
          )}
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="clienteDestinoReferencia" className={labelClass}>
            Cliente destino (referencia del ticket)
          </label>
          <input
            id="clienteDestinoReferencia"
            name="clienteDestinoReferencia"
            ref={clienteDestinoRef}
            className={inputClass}
          />
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="observaciones" className={labelClass}>
            Observaciones
          </label>
          <input
            id="observaciones"
            name="observaciones"
            ref={observacionesRef}
            className={inputClass}
          />
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

        <div className="flex flex-col gap-1">
          <label htmlFor="foto" className={labelClass}>
            Foto del ticket de báscula
          </label>
          <p className="text-xs text-muted">
            Al subir la foto se intentan llenar automáticamente los campos de
            arriba (peso, pesador, cliente, observaciones) — revísalos antes
            de guardar.
          </p>
          <input
            id="foto"
            name="foto"
            type="file"
            accept="image/*"
            capture="environment"
            required
            onChange={handleFotoChange}
            className={fileInputClass}
          />
          {ocrStatus === "leyendo" && (
            <p className="text-sm text-muted">Leyendo ticket con IA...</p>
          )}
          {ocrStatus === "error" && (
            <p className="text-sm text-danger">
              No se pudo leer el ticket automáticamente. Llena los campos manualmente.
            </p>
          )}
          {state?.errors?.foto && (
            <p className="text-sm text-danger">{state.errors.foto[0]}</p>
          )}
        </div>

        <div className="flex flex-col gap-2 rounded-md border border-border p-3">
          <span className="text-sm font-semibold">Firma de salida (transportista)</span>
          <label htmlFor="firmaSalidaNombre" className="text-sm">
            Nombre de quien entrega
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

        <div className="flex flex-col gap-2 rounded-md border border-border p-3">
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
            className={inputClass}
          />
          {state?.errors?.firmaSupervisorNombre && (
            <p className="text-sm text-danger">{state.errors.firmaSupervisorNombre[0]}</p>
          )}
          <SignaturePad name="firmaSupervisorImagen" label="Firma" />
          {state?.errors?.firmaSupervisorImagen && (
            <p className="text-sm text-danger">{state.errors.firmaSupervisorImagen[0]}</p>
          )}
        </div>

        {state?.message && <p className="text-sm text-danger">{state.message}</p>}

        <button type="submit" disabled={pending} className={buttonClass("primary")}>
          {pending ? "Guardando..." : "Cerrar pesaje"}
        </button>
      </form>
    </Card>
  );
}
