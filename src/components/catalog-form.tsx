"use client";

import { useActionState } from "react";

type Option = { value: string; label: string };

type FieldConfig = {
  name: string;
  label: string;
  type?: "text" | "email" | "password" | "number" | "select";
  required?: boolean;
  options?: Option[];
  helpText?: string;
  min?: number;
  step?: number;
  datalist?: string[];
};

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
}) {
  const [state, formAction, pending] = useActionState(action, undefined);

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
          <label htmlFor={f.name} className="text-sm font-medium">
            {f.label}
          </label>
          {f.type === "select" ? (
            <select
              id={f.name}
              name={f.name}
              required={f.required}
              defaultValue={defaultValues?.[f.name] ?? ""}
              className="rounded-md border border-black/15 px-3 py-2 dark:border-white/20 dark:bg-black"
            >
              <option value="">—</option>
              {f.options?.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          ) : (
            <>
              <input
                id={f.name}
                name={f.name}
                type={f.type ?? "text"}
                required={f.required}
                min={f.min}
                step={f.step}
                list={f.datalist ? `${f.name}-list` : undefined}
                defaultValue={defaultValues?.[f.name]}
                className="rounded-md border border-black/15 px-3 py-2 dark:border-white/20 dark:bg-black"
              />
              {f.datalist && (
                <datalist id={`${f.name}-list`}>
                  {f.datalist.map((v) => (
                    <option key={v} value={v} />
                  ))}
                </datalist>
              )}
            </>
          )}
          {f.helpText && (
            <p className="text-xs text-zinc-500">{f.helpText}</p>
          )}
          {state?.errors?.[f.name] && (
            <p className="text-sm text-red-600">{state.errors[f.name][0]}</p>
          )}
        </div>
      ))}

      {state?.message && <p className="text-sm text-red-600">{state.message}</p>}

      <button
        type="submit"
        disabled={pending}
        className="rounded-full bg-foreground px-5 py-2 text-background disabled:opacity-60"
      >
        {pending ? "Guardando..." : submitLabel}
      </button>
    </form>
  );
}
