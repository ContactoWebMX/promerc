"use client";

import { useId, useRef, useState } from "react";

export function SignaturePad({
  name,
  label,
}: {
  name: string;
  label: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const hiddenRef = useRef<HTMLInputElement>(null);
  const drawing = useRef(false);
  const [mode, setMode] = useState<"draw" | "typed">("draw");
  const [typedName, setTypedName] = useState("");
  const [captured, setCaptured] = useState(false);
  const typedInputId = useId();

  function pos(e: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY };
  }

  function start(e: React.PointerEvent<HTMLCanvasElement>) {
    drawing.current = true;
    const ctx = canvasRef.current!.getContext("2d")!;
    const { x, y } = pos(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  }

  function move(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) return;
    const ctx = canvasRef.current!.getContext("2d")!;
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    const { x, y } = pos(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  }

  function end() {
    if (!drawing.current) return;
    drawing.current = false;
    hiddenRef.current!.value = canvasRef.current!.toDataURL("image/png");
    setCaptured(true);
  }

  function clear() {
    const canvas = canvasRef.current!;
    canvas.getContext("2d")!.clearRect(0, 0, canvas.width, canvas.height);
    hiddenRef.current!.value = "";
    setCaptured(false);
    setTypedName("");
  }

  function renderTyped(value: string) {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!value.trim()) {
      hiddenRef.current!.value = "";
      setCaptured(false);
      return;
    }
    ctx.fillStyle = "#000000";
    ctx.font = "italic 32px cursive, serif";
    ctx.textBaseline = "middle";
    ctx.fillText(value.trim(), 12, canvas.height / 2, canvas.width - 24);
    hiddenRef.current!.value = canvas.toDataURL("image/png");
    setCaptured(true);
  }

  function toggleMode() {
    clear();
    setMode((m) => (m === "draw" ? "typed" : "draw"));
  }

  return (
    <div className="flex flex-col gap-1">
      <span className="text-sm font-medium">{label}</span>

      {mode === "draw" ? (
        <canvas
          ref={canvasRef}
          width={320}
          height={140}
          role="img"
          aria-label={`Área de firma a mano para ${label}. Si no puedes usar mouse o pantalla táctil, usa la opción "No puedo firmar a mano" abajo.`}
          className="w-full max-w-sm touch-none rounded-md border border-border bg-white"
          onPointerDown={start}
          onPointerMove={move}
          onPointerUp={end}
          onPointerLeave={end}
        />
      ) : (
        <div className="flex flex-col gap-1">
          <label htmlFor={typedInputId} className="text-xs text-muted">
            Escribe el nombre para generar la firma
          </label>
          <input
            id={typedInputId}
            type="text"
            value={typedName}
            onChange={(e) => {
              setTypedName(e.target.value);
              renderTyped(e.target.value);
            }}
            className="w-full max-w-sm rounded-md border border-border px-2 py-1.5 text-sm"
          />
          <canvas ref={canvasRef} width={320} height={140} aria-hidden className="hidden" />
        </div>
      )}

      <input ref={hiddenRef} type="hidden" name={name} />

      <div className="flex flex-wrap items-center gap-1">
        <button
          type="button"
          onClick={clear}
          className="inline-flex min-h-11 items-center px-2 text-xs text-primary hover:underline"
        >
          Limpiar firma
        </button>
        <button
          type="button"
          onClick={toggleMode}
          className="inline-flex min-h-11 items-center px-2 text-xs text-primary hover:underline"
        >
          {mode === "draw"
            ? "No puedo firmar a mano — escribir el nombre"
            : "Volver a firma a mano"}
        </button>
      </div>

      <p aria-live="polite" className="sr-only">
        {captured ? "Firma capturada." : ""}
      </p>
    </div>
  );
}
