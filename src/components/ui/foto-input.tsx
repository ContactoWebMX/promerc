"use client";

import { useRef, useState } from "react";
import { buttonClass } from "@/components/ui/button";

// Tres <input type="file">: uno real (el que se envía con el form, sin
// `capture`) y dos disparadores ocultos y ESTÁTICOS — uno con `capture`
// fijo desde el primer render (botón "Tomar foto"), otro sin él (botón
// "Examinar archivo"). Antes el mismo input cambiaba el atributo `capture`
// por JS justo antes de abrirse, pero varios navegadores de celular solo
// abren la cámara si `capture` ya estaba en el HTML desde que el input se
// creó — togglearlo con setAttribute() se ignora en esos casos y el botón
// "Tomar foto" termina abriendo el picker normal (o no abre nada). El
// archivo elegido en cualquiera de los dos disparadores se copia al input
// real vía DataTransfer, así el form solo manda un campo `name`.
export function FotoInput({
  id,
  name,
  label,
  required,
  helpText,
  error,
  onFileChange,
}: {
  id: string;
  name: string;
  label: string;
  required?: boolean;
  helpText?: string;
  error?: string;
  onFileChange?: (file: File | null) => void;
}) {
  const realRef = useRef<HTMLInputElement>(null);
  const camaraRef = useRef<HTMLInputElement>(null);
  const archivoRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  function recibir(file: File | null) {
    if (realRef.current) {
      const dt = new DataTransfer();
      if (file) dt.items.add(file);
      realRef.current.files = dt.files;
    }
    setFileName(file?.name ?? null);
    onFileChange?.(file);
  }

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      {helpText && <p className="text-xs text-muted">{helpText}</p>}

      <input
        ref={realRef}
        id={id}
        name={name}
        type="file"
        accept="image/*"
        required={required}
        className="sr-only"
        tabIndex={-1}
      />
      <input
        ref={camaraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        tabIndex={-1}
        onChange={(e) => recibir(e.target.files?.[0] ?? null)}
      />
      <input
        ref={archivoRef}
        type="file"
        accept="image/*"
        className="sr-only"
        tabIndex={-1}
        onChange={(e) => recibir(e.target.files?.[0] ?? null)}
      />

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => camaraRef.current?.click()}
          className={buttonClass("primary", "sm")}
        >
          Tomar foto
        </button>
        <button
          type="button"
          onClick={() => archivoRef.current?.click()}
          className={buttonClass("secondary", "sm")}
        >
          Examinar archivo
        </button>
      </div>

      {fileName && <p className="text-xs text-muted">Seleccionado: {fileName}</p>}
      {error && <p className="text-sm text-danger">{error}</p>}
    </div>
  );
}
