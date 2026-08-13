"use client";

import { useActionState, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { buttonClass } from "@/components/ui/button";
import { inputClass, labelClass } from "@/components/ui/field";
import { FotoInput } from "@/components/ui/foto-input";
import { FormSection } from "@/components/ui/form-section";
import { leerTicketOffline } from "@/lib/ocr-offline";
import { leerTicketConIA } from "@/app/(app)/pesajes/[id]/actions";
import { crearPesaje } from "./actions";
import type { CatalogFormState } from "@/components/catalog-form";

export function NuevoPesajeForm({
  ubicaciones,
  proveedores,
  transportistas,
  ubicacionDefaultId,
  fechaHoy,
}: {
  ubicaciones: { id: number; nombre: string }[];
  proveedores: { id: number; nombre: string }[];
  transportistas: { nombre: string; placas: string }[];
  ubicacionDefaultId: string;
  fechaHoy: string;
}) {
  const [state, action, pending] = useActionState<CatalogFormState, FormData>(
    crearPesaje,
    undefined,
  );

  const [ocrStatus, setOcrStatus] = useState<
    "idle" | "leyendo" | "leyendo-offline" | "offline" | "error"
  >("idle");
  const [ocrError, setOcrError] = useState<string | null>(null);
  const folioTicketRef = useRef<HTMLInputElement>(null);
  const idOperacionRef = useRef<HTMLInputElement>(null);
  const taraKgRef = useRef<HTMLInputElement>(null);
  const fechaTicketRef = useRef<HTMLInputElement>(null);
  const horaTicketRef = useRef<HTMLInputElement>(null);

  const nombresConocidos = new Set(transportistas.map((t) => t.nombre));
  const placasConocidas = new Set(transportistas.map((t) => t.placas));
  const [operadorNombre, setOperadorNombre] = useState("");
  const [placas, setPlacas] = useState("");

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
    if (datos.folioTicket && folioTicketRef.current) {
      folioTicketRef.current.value = datos.folioTicket;
    }
    if (datos.idOperacionBascula && idOperacionRef.current) {
      idOperacionRef.current.value = datos.idOperacionBascula;
    }
    if (datos.pesoKg != null && taraKgRef.current) {
      taraKgRef.current.value = String(datos.pesoKg);
    }
    if (datos.fecha && fechaTicketRef.current) fechaTicketRef.current.value = datos.fecha;
    if (datos.hora && horaTicketRef.current) horaTicketRef.current.value = datos.hora;
  }

  // Respaldo local (sin conexión a ningún servicio) cuando Claude no responde.
  async function intentarLecturaOffline(foto: File) {
    setOcrStatus("leyendo-offline");
    try {
      const offline = await leerTicketOffline(foto);
      if (offline.pesoKg != null && taraKgRef.current) {
        taraKgRef.current.value = String(offline.pesoKg);
      }
      if (offline.folioTicket && folioTicketRef.current) {
        folioTicketRef.current.value = offline.folioTicket;
      }
      setOcrStatus(offline.pesoKg != null || offline.folioTicket ? "offline" : "error");
    } catch {
      setOcrStatus("error");
    }
  }

  return (
    <Card className="max-w-2xl">
      <form action={action} className="flex flex-col gap-5">
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
            label="Foto del ticket de báscula (tara — camión vacío)"
            required
            helpText="Al subir la foto se intentan llenar automáticamente el folio, el ID de operación y el peso de tara — revísalos antes de guardar."
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
              Ticket leído sin conexión — es una lectura aproximada, revísala
              antes de guardar.
            </p>
          )}
          {ocrStatus === "error" && (
            <p className="text-sm text-danger">
              {ocrError ?? "No se pudo leer el ticket automáticamente. Llena los campos manualmente."}
            </p>
          )}

          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="flex flex-1 flex-col gap-1">
              <label htmlFor="folioTicket" className={labelClass}>
                Folio del ticket de báscula
              </label>
              <input
                id="folioTicket"
                name="folioTicket"
                required
                ref={folioTicketRef}
                className={inputClass}
              />
              {state?.errors?.folioTicket && (
                <p className="text-sm text-danger">{state.errors.folioTicket[0]}</p>
              )}
            </div>

            <div className="flex flex-1 flex-col gap-1">
              <label htmlFor="idOperacionBascula" className={labelClass}>
                ID de operación de báscula (opcional)
              </label>
              <input
                id="idOperacionBascula"
                name="idOperacionBascula"
                ref={idOperacionRef}
                className={inputClass}
              />
            </div>
          </div>
        </FormSection>

        <FormSection title="Camión y proveedor">
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="flex flex-1 flex-col gap-1">
              <label htmlFor="ubicacionId" className={labelClass}>
                Ubicación
              </label>
              <select
                id="ubicacionId"
                name="ubicacionId"
                required
                defaultValue={ubicacionDefaultId}
                className={inputClass}
              >
                <option value="">—</option>
                {ubicaciones.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.nombre}
                  </option>
                ))}
              </select>
              {state?.errors?.ubicacionId && (
                <p className="text-sm text-danger">{state.errors.ubicacionId[0]}</p>
              )}
            </div>

            <div className="flex flex-1 flex-col gap-1">
              <label htmlFor="proveedorId" className={labelClass}>
                Proveedor
              </label>
              <select id="proveedorId" name="proveedorId" required className={inputClass}>
                <option value="">—</option>
                {proveedores.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nombre}
                  </option>
                ))}
              </select>
              {state?.errors?.proveedorId && (
                <p className="text-sm text-danger">{state.errors.proveedorId[0]}</p>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="flex flex-1 flex-col gap-1">
              <label htmlFor="operadorNombre" className={labelClass}>
                Nombre del operador (transportista)
              </label>
              <input
                id="operadorNombre"
                name="operadorNombre"
                required
                list="operadorNombre-list"
                value={operadorNombre}
                onChange={(e) => setOperadorNombre(e.target.value)}
                className={inputClass}
              />
              <datalist id="operadorNombre-list">
                {[...nombresConocidos].map((v) => (
                  <option key={v} value={v} />
                ))}
              </datalist>
              {operadorNombre.trim() !== "" && !nombresConocidos.has(operadorNombre.trim()) && (
                <p className="text-xs text-muted">
                  Transportista nuevo — se registrará con este nombre, verifica que esté bien escrito.
                </p>
              )}
              {state?.errors?.operadorNombre && (
                <p className="text-sm text-danger">{state.errors.operadorNombre[0]}</p>
              )}
            </div>

            <div className="flex flex-1 flex-col gap-1">
              <label htmlFor="placas" className={labelClass}>
                Placas
              </label>
              <input
                id="placas"
                name="placas"
                required
                list="placas-list"
                value={placas}
                onChange={(e) => setPlacas(e.target.value)}
                className={inputClass}
              />
              <datalist id="placas-list">
                {[...placasConocidas].map((v) => (
                  <option key={v} value={v} />
                ))}
              </datalist>
              {placas.trim() !== "" && !placasConocidas.has(placas.trim()) && (
                <p className="text-xs text-muted">
                  Placas nuevas — verifica que estén bien escritas antes de guardar.
                </p>
              )}
              {state?.errors?.placas && (
                <p className="text-sm text-danger">{state.errors.placas[0]}</p>
              )}
            </div>
          </div>
        </FormSection>

        <FormSection title="Peso">
          <div className="flex flex-col gap-1">
            <label htmlFor="taraKg" className={labelClass}>
              Tara (kg) — camión vacío
            </label>
            <input
              id="taraKg"
              name="taraKg"
              type="number"
              min={0}
              step={0.01}
              required
              ref={taraKgRef}
              className={inputClass}
            />
            {state?.errors?.taraKg && (
              <p className="text-sm text-danger">{state.errors.taraKg[0]}</p>
            )}
          </div>
        </FormSection>

        {state?.message && <p className="text-sm text-danger">{state.message}</p>}

        {(ocrStatus === "leyendo" || ocrStatus === "leyendo-offline") && (
          <p className="text-xs text-muted">
            Leyendo ticket — puedes seguir llenando o guardar sin esperar.
          </p>
        )}
        <button type="submit" disabled={pending} className={buttonClass("primary")}>
          {pending ? "Guardando..." : "Registrar tara"}
        </button>
      </form>
    </Card>
  );
}
