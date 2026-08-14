"use client";

import { useActionState, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { buttonClass } from "@/components/ui/button";
import { inputClass, labelClass } from "@/components/ui/field";
import { ConfirmSubmitButton } from "@/components/ui/confirm-submit-button";
import { FotoInput } from "@/components/ui/foto-input";
import { FormSection } from "@/components/ui/form-section";
import { leerTicketOffline } from "@/lib/ocr-offline";
import { useFallaRed } from "@/lib/use-falla-red";
import { cerrarPesaje, leerTicketConIA, type CerrarPesajeState } from "./actions";

// Paso 2 del cierre: se llena al pasar por báscula, cuando ya se conoce el
// peso real — artículo, pacas y destino ya se registraron en "salida".
export function CerrarPesajeForm({
  pesajeId,
  taraKg,
  fechaHoy,
}: {
  pesajeId: number;
  taraKg: string;
  fechaHoy: string;
}) {
  const [state, action, pending] = useActionState<CerrarPesajeState, FormData>(
    cerrarPesaje,
    undefined,
  );

  const [ocrStatus, setOcrStatus] = useState<
    "idle" | "leyendo" | "leyendo-offline" | "offline" | "error"
  >("idle");

  const fallaRed = useFallaRed(pending, state);

  const grossKgRef = useRef<HTMLInputElement>(null);
  const pesadorNombreRef = useRef<HTMLInputElement>(null);
  const observacionesRef = useRef<HTMLInputElement>(null);
  const fechaTicketRef = useRef<HTMLInputElement>(null);
  const horaTicketRef = useRef<HTMLInputElement>(null);

  const [ocrError, setOcrError] = useState<string | null>(null);

  async function handleFotoChange(foto: File | null) {
    if (!foto) return;

    setOcrStatus("leyendo");
    const fd = new FormData();
    fd.append("foto", foto);
    const { datos, error } = await leerTicketConIA(fd);
    if (error || !datos) {
      setOcrError(error ?? null);
      await intentarLecturaOffline(foto);
      return;
    }
    setOcrStatus("idle");
    if (datos.pesoKg != null && grossKgRef.current) {
      grossKgRef.current.value = String(datos.pesoKg);
    }
    if (datos.pesadorNombre && pesadorNombreRef.current) {
      pesadorNombreRef.current.value = datos.pesadorNombre.toUpperCase();
    }
    if (datos.observaciones && observacionesRef.current) {
      observacionesRef.current.value = datos.observaciones.toUpperCase();
    }
    if (datos.fecha && fechaTicketRef.current) fechaTicketRef.current.value = datos.fecha;
    if (datos.hora && horaTicketRef.current) horaTicketRef.current.value = datos.hora;
  }

  // Si Claude no respondió (sin señal, sin API key, lo que sea), se lee el
  // ticket localmente con Tesseract — no depende de ninguna conexión.
  async function intentarLecturaOffline(foto: File) {
    setOcrStatus("leyendo-offline");
    try {
      const offline = await leerTicketOffline(foto);
      if (offline.pesoKg != null && grossKgRef.current) {
        grossKgRef.current.value = String(offline.pesoKg);
      }
      setOcrStatus(offline.pesoKg != null ? "offline" : "error");
    } catch {
      setOcrStatus("error");
    }
  }

  return (
    <Card className="max-w-2xl">
      <form action={action} className="flex flex-col gap-5">
        <input type="hidden" name="id" value={pesajeId} />

        <div>
          <h2 className="font-semibold">Cerrar pesaje — báscula</h2>
          <p className="mt-1 text-sm text-muted">
            Tara registrada: <strong className="text-foreground">{taraKg} kg</strong>.
            El neto se calcula automáticamente al capturar el peso cargado.
          </p>
        </div>

        <FormSection title="Ticket de báscula">
          <div className="flex gap-3">
            <div className="flex flex-1 flex-col gap-1">
              <label htmlFor="fechaTicket" className={labelClass}>
                Fecha del ticket
              </label>
              <input
                id="fechaTicket"
                name="fechaTicket"
                type="date"
                required
                defaultValue={fechaHoy}
                ref={fechaTicketRef}
                className={inputClass}
              />
            </div>
            <div className="flex flex-1 flex-col gap-1">
              <label htmlFor="horaTicket" className={labelClass}>
                Hora del ticket
              </label>
              <input
                id="horaTicket"
                name="horaTicket"
                type="time"
                ref={horaTicketRef}
                className={inputClass}
              />
            </div>
          </div>
          <p className="text-xs text-muted">
            Precargada con hoy — ajústala si el ticket físico llegó días después de pesar.
          </p>

          <FotoInput
            id="foto"
            name="foto"
            label="Foto del ticket de báscula"
            required
            helpText="Al subir la foto se intentan llenar automáticamente los campos de abajo (peso, pesador, observaciones) — revísalos antes de guardar."
            error={state?.errors?.foto?.[0]}
            onFileChange={handleFotoChange}
          />
          {ocrStatus === "leyendo" && (
            <p className="text-sm text-muted">Leyendo ticket con IA...</p>
          )}
          {ocrStatus === "leyendo-offline" && (
            <p className="text-sm text-muted">
              Sin conexión con el servicio en línea — leyendo el ticket en el
              celular (puede tardar unos segundos la primera vez)...
            </p>
          )}
          {ocrStatus === "offline" && (
            <p className="text-sm font-medium text-muted">
              Ticket leído sin conexión (peso) — es una lectura aproximada,
              revísalo antes de guardar.
            </p>
          )}
          {ocrStatus === "error" && (
            <p className="text-sm text-danger">
              {ocrError ?? "No se pudo leer el ticket automáticamente. Llena los campos manualmente."}
            </p>
          )}

          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="flex flex-1 flex-col gap-1">
              <label htmlFor="grossKg" className={labelClass}>
                Peso cargado (kg)
              </label>
              <input
                id="grossKg"
                name="grossKg"
                type="number"
                inputMode="decimal"
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

            <div className="flex flex-1 flex-col gap-1">
              <label htmlFor="pesadorNombre" className={labelClass}>
                Nombre del pesador
              </label>
              <input
                id="pesadorNombre"
                name="pesadorNombre"
                required
                ref={pesadorNombreRef}
                onInput={(e) => {
                  e.currentTarget.value = e.currentTarget.value.toUpperCase();
                }}
                className={inputClass}
              />
              {state?.errors?.pesadorNombre && (
                <p className="text-sm text-danger">{state.errors.pesadorNombre[0]}</p>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="observaciones" className={labelClass}>
              Observaciones
            </label>
            <input
              id="observaciones"
              name="observaciones"
              ref={observacionesRef}
              onInput={(e) => {
                e.currentTarget.value = e.currentTarget.value.toUpperCase();
              }}
              className={inputClass}
            />
          </div>
        </FormSection>

        {state?.message && <p className="text-sm text-danger">{state.message}</p>}

        {fallaRed && (
          <p className="rounded-md border border-danger/40 bg-danger/10 p-3 text-sm text-danger">
            No se pudo guardar — parece que se perdió la conexión. Tus datos
            siguen aquí, solo vuelve a intentar cuando tengas señal.
          </p>
        )}

        {(ocrStatus === "leyendo" || ocrStatus === "leyendo-offline") && (
          <p className="text-xs text-muted">
            Leyendo ticket — puedes seguir llenando o guardar sin esperar.
          </p>
        )}
        <ConfirmSubmitButton
          confirmMessage="¿Cerrar este pesaje con este peso? Se crea el lote de este artículo y no se puede deshacer sin registrar una corrección."
          disabled={pending}
          className={buttonClass("primary")}
        >
          {pending ? "Guardando..." : "Cerrar pesaje"}
        </ConfirmSubmitButton>
      </form>
    </Card>
  );
}
