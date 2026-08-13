"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { TIPO_NOTIFICACION_LABELS } from "@/lib/notificaciones";
import type { TipoNotificacion } from "@/generated/prisma/enums";

const INTERVALO_MS = 45_000;

type NotificacionItem = {
  id: number;
  tipo: TipoNotificacion;
  leidoEn: string | null;
  createdAt: string;
  resumen: Record<string, unknown>;
  ruta: string | null;
};

function resumenTexto(resumen: Record<string, unknown>): string {
  if (resumen.folioTicket) return `Ticket ${resumen.folioTicket}`;
  if (resumen.clienteNombre) return String(resumen.clienteNombre);
  return "";
}

export function NotificationBell() {
  const [noLeidas, setNoLeidas] = useState(0);
  const [items, setItems] = useState<NotificacionItem[]>([]);
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const contenedorRef = useRef<HTMLDivElement>(null);

  const cargar = useCallback(async () => {
    if (document.visibilityState !== "visible") return;
    const res = await fetch("/api/notificaciones");
    if (!res.ok) return;
    const data = await res.json();
    setNoLeidas(data.noLeidas);
    setItems(data.items);
  }, []);

  useEffect(() => {
    // carga inicial + polling: cargar() es async y su setState ocurre después
    // del await, no sincrónico en el cuerpo del efecto; la regla no distingue
    // esa frontera.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    cargar();
    const interval = setInterval(cargar, INTERVALO_MS);
    document.addEventListener("visibilitychange", cargar);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", cargar);
    };
  }, [cargar]);

  useEffect(() => {
    function alClicAfuera(e: MouseEvent) {
      if (contenedorRef.current && !contenedorRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", alClicAfuera);
    return () => document.removeEventListener("mousedown", alClicAfuera);
  }, []);

  function marcarLeida(item: NotificacionItem) {
    fetch(`/api/notificaciones/${item.id}/leer`, { method: "POST" });
    setItems((prev) =>
      prev.map((i) => (i.id === item.id ? { ...i, leidoEn: new Date().toISOString() } : i)),
    );
    if (!item.leidoEn) setNoLeidas((n) => Math.max(0, n - 1));
    setOpen(false);
    if (item.ruta) router.push(item.ruta);
  }

  async function marcarTodas() {
    await fetch("/api/notificaciones/leer-todas", { method: "POST" });
    setItems((prev) => prev.map((i) => ({ ...i, leidoEn: i.leidoEn ?? new Date().toISOString() })));
    setNoLeidas(0);
  }

  return (
    <div ref={contenedorRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Notificaciones"
        className="relative flex h-11 w-11 items-center justify-center rounded-md hover:bg-border/50"
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2}>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M15 17h5l-1.4-1.4A2 2 0 0 1 18 14.2V11a6 6 0 1 0-12 0v3.2c0 .5-.2 1-.6 1.4L4 17h5m6 0v1a3 3 0 1 1-6 0v-1m6 0H9"
          />
        </svg>
        {noLeidas > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-semibold text-white">
            {noLeidas > 9 ? "9+" : noLeidas}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-20 mt-2 w-80 rounded-md border border-border bg-surface shadow-lg">
          <div className="flex items-center justify-between border-b border-border px-3 py-2">
            <span className="text-sm font-medium">Notificaciones</span>
            {noLeidas > 0 && (
              <button
                type="button"
                onClick={marcarTodas}
                className="text-xs text-primary hover:underline"
              >
                Marcar todas como leídas
              </button>
            )}
          </div>
          <div className="max-h-96 overflow-y-auto">
            {items.length === 0 && (
              <p className="p-4 text-center text-sm text-muted">Sin notificaciones.</p>
            )}
            {items.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => marcarLeida(item)}
                className={`flex w-full flex-col items-start gap-0.5 border-b border-border px-3 py-2 text-left text-sm hover:bg-border/30 ${
                  item.leidoEn ? "" : "bg-primary/5"
                }`}
              >
                <span className="font-medium">{TIPO_NOTIFICACION_LABELS[item.tipo]}</span>
                <span className="text-xs text-muted">{resumenTexto(item.resumen)}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
