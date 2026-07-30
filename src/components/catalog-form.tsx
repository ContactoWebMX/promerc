"use client";

import { useActionState, useId, useState } from "react";
import { buttonClass } from "@/components/ui/button";
import { inputClass, labelClass } from "@/components/ui/field";
import { ConfirmSubmitButton } from "@/components/ui/confirm-submit-button";
import { useFallaRed } from "@/lib/use-falla-red";

type Option = { value: string; label: string; group?: string };

// Agrupa preservando el orden de primera aparición de cada grupo — evita
// reordenar visualmente algo que ya viene ordenado con intención (ej. lotes
// por fecha) solo por agrupar.
function agruparOpciones(options: Option[]): Map<string | undefined, Option[]> {
  const grupos = new Map<string | undefined, Option[]>();
  for (const o of options) {
    const lista = grupos.get(o.group);
    if (lista) lista.push(o);
    else grupos.set(o.group, [o]);
  }
  return grupos;
}

type FieldConfig = {
  name: string;
  label: string;
  type?: "text" | "email" | "password" | "number" | "select" | "combobox";
  required?: boolean;
  options?: Option[];
  helpText?: string;
  min?: number;
  step?: number;
  datalist?: string[];
};

// Selector con filtro por texto para catálogos largos (ej. lotes abiertos):
// un input de texto + <datalist> de las opciones visibles, que resuelve el
// id real a un input oculto por coincidencia exacta de label. A diferencia
// de "select" no soporta <optgroup> (datalist no lo permite), por eso el
// label de cada opción ya trae el grupo incluido (ver ventas/nuevo/page.tsx).
function ComboboxField({
  id,
  name,
  options,
  required,
  defaultValue,
}: {
  id: string;
  name: string;
  options: Option[];
  required?: boolean;
  defaultValue?: string;
}) {
  const porLabel = new Map(options.map((o) => [o.label, o.value]));
  const labelInicial = options.find((o) => o.value === defaultValue)?.label ?? "";
  const [texto, setTexto] = useState(labelInicial);
  const valorId = porLabel.get(texto) ?? "";
  const listId = `${id}-combobox-list`;

  return (
    <>
      <input
        id={id}
        list={listId}
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        placeholder="Escribe para buscar..."
        autoComplete="off"
        required={required}
        className={inputClass}
      />
      <datalist id={listId}>
        {options.map((o) => (
          <option key={o.value} value={o.label} />
        ))}
      </datalist>
      <input type="hidden" name={name} value={valorId} />
      {texto.trim() !== "" && !valorId && (
        <p className="text-xs text-muted">Ningún resultado coincide con ese texto.</p>
      )}
    </>
  );
}

export type CatalogFormState =
  | { errors?: Record<string, string[]>; message?: string }
  | undefined;

export function CatalogForm({
  action,
  fields,
  submitLabel,
  defaultValues,
  hiddenId,
  hiddenFields,
  confirmMessage,
  confirmDetails,
}: {
  action: (
    state: CatalogFormState,
    formData: FormData,
  ) => Promise<CatalogFormState>;
  fields: FieldConfig[];
  submitLabel: string;
  defaultValues?: Record<string, string>;
  hiddenId?: number;
  hiddenFields?: Record<string, string | number>;
  confirmMessage?: string;
  confirmDetails?: { label: string; value: string }[];
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const fallaRed = useFallaRed(pending, state);
  // Prefijo único por instancia: dos CatalogForm en la misma página (ej. dos
  // ActionDialog, cada uno con un campo "motivo") no deben repetir id — el id
  // es solo para <label htmlFor>, el name es el que de verdad importa al
  // enviar el form.
  const uid = useId();
  const fieldId = (name: string) => `${uid}-${name}`;

  return (
    <form action={formAction} className="flex w-full max-w-sm flex-col gap-4">
      {hiddenId !== undefined && (
        <input type="hidden" name="id" value={hiddenId} />
      )}
      {hiddenFields &&
        Object.entries(hiddenFields).map(([name, value]) => (
          <input key={name} type="hidden" name={name} value={value} />
        ))}
      {fields.map((f) => (
        <div key={f.name} className="flex flex-col gap-1">
          <label htmlFor={fieldId(f.name)} className={labelClass}>
            {f.label}
          </label>
          {f.type === "combobox" ? (
            <ComboboxField
              id={fieldId(f.name)}
              name={f.name}
              options={f.options ?? []}
              required={f.required}
              defaultValue={defaultValues?.[f.name]}
            />
          ) : f.type === "select" ? (
            <select
              id={fieldId(f.name)}
              name={f.name}
              required={f.required}
              defaultValue={defaultValues?.[f.name] ?? ""}
              className={inputClass}
            >
              <option value="">—</option>
              {f.options?.some((o) => o.group)
                ? [...agruparOpciones(f.options)].map(([grupo, opciones]) =>
                    grupo ? (
                      <optgroup key={grupo} label={grupo}>
                        {opciones.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </optgroup>
                    ) : (
                      opciones.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))
                    ),
                  )
                : f.options?.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
            </select>
          ) : (
            <>
              <input
                id={fieldId(f.name)}
                name={f.name}
                type={f.type ?? "text"}
                required={f.required}
                min={f.min}
                step={f.step}
                list={f.datalist ? fieldId(`${f.name}-list`) : undefined}
                defaultValue={defaultValues?.[f.name]}
                className={inputClass}
              />
              {f.datalist && (
                <datalist id={fieldId(`${f.name}-list`)}>
                  {f.datalist.map((v) => (
                    <option key={v} value={v} />
                  ))}
                </datalist>
              )}
            </>
          )}
          {f.helpText && <p className="text-xs text-muted">{f.helpText}</p>}
          {state?.errors?.[f.name] && (
            <p className="text-sm text-danger">{state.errors[f.name][0]}</p>
          )}
        </div>
      ))}

      {state?.message && <p className="text-sm text-danger">{state.message}</p>}

      {fallaRed && (
        <p className="rounded-md border border-danger/40 bg-danger/10 p-3 text-sm text-danger">
          No se pudo guardar — parece que se perdió la conexión. Tus datos
          siguen aquí, solo vuelve a intentar cuando tengas señal.
        </p>
      )}

      {confirmMessage ? (
        <ConfirmSubmitButton
          confirmMessage={confirmMessage}
          details={confirmDetails}
          disabled={pending}
          className={buttonClass("primary")}
        >
          {pending ? "Guardando..." : submitLabel}
        </ConfirmSubmitButton>
      ) : (
        <button type="submit" disabled={pending} className={buttonClass("primary")}>
          {pending ? "Guardando..." : submitLabel}
        </button>
      )}
    </form>
  );
}
