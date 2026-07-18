"use client";

import { useRef } from "react";

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

  function pos(e: React.PointerEvent<HTMLCanvasElement>) {
    const rect = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
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
  }

  function clear() {
    const canvas = canvasRef.current!;
    canvas.getContext("2d")!.clearRect(0, 0, canvas.width, canvas.height);
    hiddenRef.current!.value = "";
  }

  return (
    <div className="flex flex-col gap-1">
      <span className="text-sm font-medium">{label}</span>
      <canvas
        ref={canvasRef}
        width={320}
        height={140}
        className="touch-none rounded-md border border-black/15 bg-white dark:border-white/20"
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={end}
        onPointerLeave={end}
      />
      <input ref={hiddenRef} type="hidden" name={name} />
      <button
        type="button"
        onClick={clear}
        className="self-start text-xs underline"
      >
        Limpiar firma
      </button>
    </div>
  );
}
