"use client";

import { useActionState } from "react";
import Link from "next/link";
import { buttonClass } from "@/components/ui/button";
import { inputClass, labelClass } from "@/components/ui/field";
import { requestPasswordReset } from "./actions";

export function RequestResetForm() {
  const [state, action, pending] = useActionState(
    requestPasswordReset,
    undefined,
  );

  return (
    <form action={action} className="flex w-full flex-col gap-4">
      <div className="flex flex-col gap-1">
        <label htmlFor="email" className={labelClass}>
          Correo
        </label>
        <input id="email" name="email" type="email" required className={inputClass} />
        {state?.errors?.email && (
          <p className="text-sm text-danger">{state.errors.email[0]}</p>
        )}
      </div>

      {state?.message && <p className="text-sm text-muted">{state.message}</p>}

      <button type="submit" disabled={pending} className={buttonClass("primary")}>
        {pending ? "Enviando..." : "Enviar enlace de recuperación"}
      </button>

      <Link href="/login" className={`${buttonClass("link")} text-center`}>
        Volver al login
      </Link>
    </form>
  );
}
