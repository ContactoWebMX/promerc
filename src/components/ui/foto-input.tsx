"use client";

import { useRef, useState } from "react";
import { buttonClass } from "@/components/ui/button";

const MAX_DIMENSION = 2000;
const CALIDAD_WEBP = 0.85;
const EXT_BY_MIME: Record<string, string> = {
  "image/webp": "webp",
  "image/png": "png",
  "image/jpeg": "jpg",
};

// Redimensiona y reconvierte a WebP en el navegador antes de subir — las
// fotos de cámara del celular llegan a pesar varios MB, esto reduce lo que
// viaja por la red y ocupa en el servidor sin intervención del usuario. Si
// el navegador no soporta codificar WebP, canvas.toBlob cae a PNG (así lo
// define la especificación); si decodificar falla por cualquier motivo, o el
// resultado no queda más chico que el original, se usa el archivo original
// tal cual — nunca bloquea la subida.
async function comprimirImagen(file: File): Promise<File> {
  if (!file.type.startsWith("image/")) return file;

  try {
    const bitmap = await createImageBitmap(file);
    const escala = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
    const width = Math.round(bitmap.width * escala);
    const height = Math.round(bitmap.height * escala);

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/webp", CALIDAD_WEBP),
    );
    if (!blob || blob.size >= file.size) return file;

    const ext = EXT_BY_MIME[blob.type] ?? "webp";
    const nombre = file.name.replace(/\.[^.]+$/, "") + `.${ext}`;
    return new File([blob], nombre, { type: blob.type, lastModified: file.lastModified });
  } catch {
    return file;
  }
}

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
  const [comprimiendo, setComprimiendo] = useState(false);

  async function recibir(file: File | null) {
    // onFileChange recibe el archivo ORIGINAL, sin comprimir — quien lo usa
    // hoy es la lectura con IA del ticket (leerTicketConIA/leerTicketOffline),
    // y comprimir antes de mandarlo pierde nitidez en números impresos o
    // escritos a mano, justo lo que hace fallar esa lectura. La compresión
    // solo afecta al archivo que de verdad se sube al guardar el formulario.
    onFileChange?.(file);

    let final = file;
    if (file) {
      setComprimiendo(true);
      final = await comprimirImagen(file);
      setComprimiendo(false);
    }
    if (realRef.current) {
      const dt = new DataTransfer();
      if (final) dt.items.add(final);
      realRef.current.files = dt.files;
    }
    setFileName(final?.name ?? null);
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
          disabled={comprimiendo}
          onClick={() => camaraRef.current?.click()}
          className={buttonClass("primary", "sm")}
        >
          Tomar foto
        </button>
        <button
          type="button"
          disabled={comprimiendo}
          onClick={() => archivoRef.current?.click()}
          className={buttonClass("secondary", "sm")}
        >
          Examinar archivo
        </button>
      </div>

      {comprimiendo && <p className="text-xs text-muted">Comprimiendo imagen...</p>}
      {fileName && !comprimiendo && (
        <p className="text-xs text-muted">Seleccionado: {fileName}</p>
      )}
      {error && <p className="text-sm text-danger">{error}</p>}
    </div>
  );
}
