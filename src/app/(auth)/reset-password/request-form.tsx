"use client";

import { useActionState } from "react";
import Link from "next/link";
import { requestPasswordReset } from "./actions";

export function RequestResetForm() {
  const [state, action, pending] = useActionState(
    requestPasswordReset,
    undefined,
  );

  return (
    <form action={action} className="flex w-full max-w-sm flex-col gap-4">
      <div className="flex flex-col gap-1">
        <label htmlFor="email" className="text-sm font-medium">
          Correo
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          className="rounded-md border border-black/15 px-3 py-2 dark:border-white/20 dark:bg-black"
        />
        {state?.errors?.email && (
          <p className="text-sm text-red-600">{state.errors.email[0]}</p>
        )}
      </div>

      {state?.message && <p className="text-sm">{state.message}</p>}

      <button
        type="submit"
        disabled={pending}
        className="rounded-full bg-foreground px-5 py-2 text-background disabled:opacity-60"
      >
        {pending ? "Enviando..." : "Enviar enlace de recuperación"}
      </button>

      <Link href="/login" className="text-sm text-center underline">
        Volver al login
      </Link>
    </form>
  );
}
