"use client";

import { useState } from "react";

// Si un envío por useActionState termina (pending true -> false) sin que el
// estado devuelto haya cambiado, no fue un error de validación (cambiaría
// state) ni un éxito con redirect (desmonta el componente antes de llegar
// aquí) — es una falla de red/transporte que Next no reporta por su cuenta.
// Verificado matando el servidor a mitad de un envío real: el formulario
// queda intacto pero sin ningún aviso. Se deriva en el render, no en un
// efecto, para detectar el cambio entre renders sin un ciclo extra.
export function useFallaRed<T>(pending: boolean, state: T): boolean {
  const [prevPending, setPrevPending] = useState(pending);
  const [prevState, setPrevState] = useState(state);
  const [fallaRed, setFallaRed] = useState(false);
  if (pending !== prevPending) {
    setFallaRed(prevPending && !pending && state === prevState);
    setPrevPending(pending);
    setPrevState(state);
  }
  return fallaRed;
}
