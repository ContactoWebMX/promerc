"use client";

import { useActionState } from "react";
import { buttonClass } from "@/components/ui/button";
import { inputClass, labelClass } from "@/components/ui/field";
import { resetPassword } from "../actions";

export function ResetForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState(resetPassword, undefined);

  return (
    <form action={action} className="flex w-full flex-col gap-4">
      <input type="hidden" name="token" value={token} />
      <div className="flex flex-col gap-1">
        <label htmlFor="password" className={labelClass}>
          Nueva contraseña
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          autoComplete="new-password"
          className={inputClass}
        />
        {state?.errors?.password && (
          <p className="text-sm text-danger">{state.errors.password[0]}</p>
        )}
      </div>

      {state?.message && <p className="text-sm text-danger">{state.message}</p>}

      <button type="submit" disabled={pending} className={buttonClass("primary")}>
        {pending ? "Guardando..." : "Guardar nueva contraseña"}
      </button>
    </form>
  );
}
