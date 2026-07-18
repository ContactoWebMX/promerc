"use client";

import { useActionState } from "react";
import { resetPassword } from "../actions";

export function ResetForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState(resetPassword, undefined);

  return (
    <form action={action} className="flex w-full max-w-sm flex-col gap-4">
      <input type="hidden" name="token" value={token} />
      <div className="flex flex-col gap-1">
        <label htmlFor="password" className="text-sm font-medium">
          Nueva contraseña
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          autoComplete="new-password"
          className="rounded-md border border-black/15 px-3 py-2 dark:border-white/20 dark:bg-black"
        />
        {state?.errors?.password && (
          <p className="text-sm text-red-600">{state.errors.password[0]}</p>
        )}
      </div>

      {state?.message && <p className="text-sm text-red-600">{state.message}</p>}

      <button
        type="submit"
        disabled={pending}
        className="rounded-full bg-foreground px-5 py-2 text-background disabled:opacity-60"
      >
        {pending ? "Guardando..." : "Guardar nueva contraseña"}
      </button>
    </form>
  );
}
