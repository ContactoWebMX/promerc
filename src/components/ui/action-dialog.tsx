"use client";

import { useRef } from "react";
import { buttonClass } from "@/components/ui/button";

// Botón que abre un modal con la acción completa adentro (editar, anular,
// eliminar) — el patrón usual de un panel administrativo: el botón mismo ya
// es la separación visual de lo destructivo/poco frecuente, y abrir el
// modal a propósito es la confirmación (no hace falta otro diálogo de
// "¿estás seguro?" encima).
export function ActionDialog({
  label,
  title,
  description,
  tone = "neutral",
  children,
}: {
  label: string;
  title: string;
  description?: string;
  tone?: "danger" | "neutral";
  children: React.ReactNode;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  return (
    <>
      <button
        type="button"
        className={buttonClass(tone === "danger" ? "danger" : "secondary", "sm")}
        onClick={() => dialogRef.current?.showModal()}
      >
        {label}
      </button>

      <dialog
        ref={dialogRef}
        className="m-auto max-h-[85vh] w-full max-w-md overflow-y-auto rounded-lg border border-border bg-surface p-0 text-foreground shadow-lg backdrop:bg-foreground/40"
        onClick={(e) => {
          if (e.target === dialogRef.current) dialogRef.current?.close();
        }}
      >
        <div className="flex flex-col gap-4 p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="font-semibold">{title}</h2>
              {description && <p className="mt-1 text-sm text-muted">{description}</p>}
            </div>
            <button
              type="button"
              onClick={() => dialogRef.current?.close()}
              aria-label="Cerrar"
              className="shrink-0 text-lg leading-none text-muted hover:text-foreground"
            >
              ✕
            </button>
          </div>
          {children}
        </div>
      </dialog>
    </>
  );
}
