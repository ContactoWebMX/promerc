"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { inputClass } from "@/components/ui/field";

export type ComboboxOption = { value: string; label: string; group?: string };

// Combobox real (input + listbox filtrado en React), en vez de <input
// list="..."> + <datalist> nativo: datalist exige coincidencia exacta con
// la etiqueta completa para resolver un valor (cualquier texto parcial sin
// terminar de escribir muestra "sin resultados" aunque la opción exista),
// no soporta agrupar visualmente, y su soporte/apariencia varía mucho entre
// navegadores — especialmente en móvil (Safari/iOS lo renderiza mal).
export function Combobox({
  id,
  name,
  options,
  required,
  defaultValue,
}: {
  id: string;
  name: string;
  options: ComboboxOption[];
  required?: boolean;
  defaultValue?: string;
}) {
  const inicial = options.find((o) => o.value === defaultValue) ?? null;
  const [query, setQuery] = useState(inicial?.label ?? "");
  const [selected, setSelected] = useState<ComboboxOption | null>(inicial);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const listboxId = `${id}-listbox`;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.label.toLowerCase().includes(q));
  }, [query, options]);

  // Agrupa preservando el orden de primera aparición de cada grupo — mismo
  // criterio que el <select> agrupado del formulario genérico.
  const grupos = useMemo(() => {
    const mapa = new Map<string | undefined, ComboboxOption[]>();
    for (const o of filtered) {
      const lista = mapa.get(o.group);
      if (lista) lista.push(o);
      else mapa.set(o.group, [o]);
    }
    return [...mapa.entries()];
  }, [filtered]);

  useEffect(() => {
    function alClicAfuera(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", alClicAfuera);
    return () => document.removeEventListener("mousedown", alClicAfuera);
  }, []);

  function elegir(o: ComboboxOption) {
    setSelected(o);
    setQuery(o.label);
    setOpen(false);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open) {
      if (e.key === "ArrowDown" || e.key === "Enter") {
        e.preventDefault();
        setOpen(true);
      }
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const o = filtered[activeIndex];
      if (o) elegir(o);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <input
        id={id}
        role="combobox"
        aria-expanded={open}
        aria-controls={listboxId}
        aria-autocomplete="list"
        autoComplete="off"
        required={required}
        value={query}
        placeholder="Escribe para buscar..."
        className={inputClass}
        onChange={(e) => {
          setQuery(e.target.value);
          setSelected(null);
          setActiveIndex(0);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
      />
      <input type="hidden" name={name} value={selected?.value ?? ""} />
      {open && (
        <ul
          id={listboxId}
          role="listbox"
          className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-md border border-border bg-surface py-1 shadow-lg"
        >
          {filtered.length === 0 && (
            <li className="px-3 py-2 text-sm text-muted">Sin resultados.</li>
          )}
          {grupos.map(([grupo, opciones]) => (
            <li key={grupo ?? "_"}>
              {grupo && (
                <p className="px-3 pt-2 pb-1 text-xs font-semibold uppercase tracking-wide text-muted">
                  {grupo}
                </p>
              )}
              <ul role="group">
                {opciones.map((o) => (
                  <li key={o.value}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={selected?.value === o.value}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => elegir(o)}
                      className={`block min-h-11 w-full px-3 py-2 text-left text-sm hover:bg-background/60 ${
                        filtered.indexOf(o) === activeIndex ? "bg-background/60" : ""
                      }`}
                    >
                      {o.label}
                    </button>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}
      {query.trim() !== "" && !selected && (
        <p className="mt-1 text-xs text-muted">Ningún resultado coincide con ese texto.</p>
      )}
    </div>
  );
}
