"use client";

import { useRef } from "react";
import { buttonClass } from "@/components/ui/button";

type DetailRow = { label: string; value: string };

export function ConfirmSubmitButton({
  confirmMessage,
  confirmLabel = "Confirmar",
  details,
  tone = "neutral",
  className,
  disabled,
  children,
}: {
  confirmMessage: string;
  confirmLabel?: string;
  details?: DetailRow[];
  tone?: "danger" | "neutral";
  className: string;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className={className}
        disabled={disabled}
        onClick={() => dialogRef.current?.showModal()}
      >
        {children}
      </button>

      <dialog
        ref={dialogRef}
        className="m-auto w-full max-w-sm rounded-lg border border-border bg-surface p-0 text-foreground shadow-lg backdrop:bg-foreground/40"
        onClick={(e) => {
          if (e.target === dialogRef.current) dialogRef.current?.close();
        }}
      >
        <div className="flex flex-col gap-4 p-5">
          <p
            className={`text-xs font-semibold uppercase tracking-wide ${
              tone === "danger" ? "text-danger" : "text-muted"
            }`}
          >
            {tone === "danger" ? "Acción irreversible" : "Confirmar"}
          </p>
          <p className="text-sm">{confirmMessage}</p>

          {details && details.length > 0 && (
            <dl className="flex flex-col gap-1 rounded-md border border-border bg-background p-3 text-sm">
              {details.map((d) => (
                <div key={d.label} className="flex justify-between gap-4">
                  <dt className="text-muted">{d.label}</dt>
                  <dd className="font-medium">{d.value}</dd>
                </div>
              ))}
            </dl>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              className={buttonClass("secondary", "sm")}
              onClick={() => dialogRef.current?.close()}
            >
              Cancelar
            </button>
            <button
              type="button"
              className={buttonClass(tone === "danger" ? "danger" : "primary", "sm")}
              onClick={() => {
                dialogRef.current?.close();
                buttonRef.current?.form?.requestSubmit();
              }}
            >
              {confirmLabel}
            </button>
          </div>
        </div>
      </dialog>
    </>
  );
}
