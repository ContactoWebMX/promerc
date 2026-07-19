"use client";

import { useActionState } from "react";
import Link from "next/link";
import { buttonClass } from "@/components/ui/button";
import { inputClass, labelClass } from "@/components/ui/field";
import { login } from "./actions";

export function LoginForm() {
  const [state, action, pending] = useActionState(login, undefined);

  return (
    <form action={action} className="flex w-full flex-col gap-4">
      <div className="flex flex-col gap-1">
        <label htmlFor="email" className={labelClass}>
          Correo
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="username"
          className={inputClass}
        />
        {state?.errors?.email && (
          <p className="text-sm text-danger">{state.errors.email[0]}</p>
        )}
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="password" className={labelClass}>
          Contraseña
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          autoComplete="current-password"
          className={inputClass}
        />
        {state?.errors?.password && (
          <p className="text-sm text-danger">{state.errors.password[0]}</p>
        )}
      </div>

      {state?.message && <p className="text-sm text-danger">{state.message}</p>}

      <button type="submit" disabled={pending} className={buttonClass("primary")}>
        {pending ? "Entrando..." : "Entrar"}
      </button>

      <Link href="/reset-password" className={`${buttonClass("link")} text-center`}>
        ¿Olvidaste tu contraseña?
      </Link>
    </form>
  );
}
