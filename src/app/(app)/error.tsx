"use client";

import { useEffect } from "react";
import { Card } from "@/components/ui/card";
import { buttonClass } from "@/components/ui/button";

// Red de seguridad para toda la app protegida: si una Server Action truena
// a mitad del envío (conexión que se cae de golpe, no solo lenta — probado
// con un abort forzado del POST), React no deja el formulario intacto con
// state sin cambiar como en una falla "suave": el error de la transición de
// useActionState se propaga hasta el boundary más cercano y desmonta todo
// el árbol. Sin este archivo no había ningún error.tsx en la app — la falla
// caía en la pantalla genérica de Next (overlay de dev / página en blanco
// en producción) y no en un mensaje que el operador entienda.
//
// A diferencia del aviso de "useFallaRed" (que si alcanza a mostrarse
// significa que el formulario sigue con lo que tenías escrito), llegar
// aquí significa que ese formulario en particular sí se perdió — hay que
// decirlo honestamente, no prometer que los datos siguen ahí.
export default function ErrorApp({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex justify-center pt-12">
      <Card className="max-w-sm text-center">
        <h2 className="font-semibold">Se perdió la conexión</h2>
        <p className="mt-2 text-sm text-muted">
          No se pudo completar la última acción — parece que la señal se cayó
          de golpe a mitad del envío. Lo que estabas llenando en ese
          formulario no se guardó, tendrás que capturarlo de nuevo cuando
          tengas señal.
        </p>
        <button
          type="button"
          onClick={() => unstable_retry()}
          className={`${buttonClass("primary")} mt-4`}
        >
          Reintentar
        </button>
      </Card>
    </div>
  );
}
