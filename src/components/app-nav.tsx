"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { buttonClass } from "@/components/ui/button";
import { NotificationBell } from "@/components/notification-bell";

type NavLink = { href: string; label: string };

function NavLinkItem({
  href,
  label,
  active,
  onClick,
}: {
  href: string;
  label: string;
  active: boolean;
  onClick?: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={`inline-flex min-h-11 items-center rounded-md px-3 text-sm font-medium transition-colors ${
        active
          ? "bg-primary/10 text-primary"
          : "text-foreground hover:bg-border/50"
      }`}
    >
      {label}
    </Link>
  );
}

function UbicacionChip({ ubicacion }: { ubicacion?: string }) {
  if (!ubicacion) return null;
  return (
    <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
      {ubicacion}
    </span>
  );
}

function BuscarForm({ className = "" }: { className?: string }) {
  return (
    <form action="/buscar" method="get" className={className}>
      <input
        type="search"
        name="q"
        placeholder="Buscar folio…"
        aria-label="Buscar por folio de ticket o lote"
        className="min-h-11 w-full rounded-md border border-border bg-background px-3 text-sm sm:w-40"
      />
    </form>
  );
}

export function AppNav({
  links,
  usuarioNombre,
  usuarioRole,
  usuarioUbicacion,
  logoutAction,
}: {
  links: NavLink[];
  usuarioNombre: string;
  usuarioRole: string;
  usuarioUbicacion?: string;
  logoutAction: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  return (
    <header className="border-b border-border bg-surface">
      <div className="flex items-center justify-between px-4 py-3 sm:px-6">
        <div className="flex items-center gap-6">
          <Link
            href="/"
            className="inline-flex min-h-11 items-center text-lg font-semibold tracking-tight"
          >
            PROMERC
          </Link>
          <nav className="hidden items-center gap-1 sm:flex">
            {links.map((l) => (
              <NavLinkItem
                key={l.href}
                href={l.href}
                label={l.label}
                active={pathname === l.href}
              />
            ))}
          </nav>
        </div>

        <div className="hidden items-center gap-3 sm:flex">
          {usuarioRole !== "CLIENTE" && <BuscarForm />}
          {usuarioRole !== "CLIENTE" && <NotificationBell />}
          <span className="text-sm text-muted">
            {usuarioNombre} · {usuarioRole}
          </span>
          <UbicacionChip ubicacion={usuarioUbicacion} />
          <form action={logoutAction}>
            <button type="submit" className={buttonClass("secondary", "sm")}>
              Salir
            </button>
          </form>
        </div>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-label="Abrir menú"
          aria-expanded={open}
          className="flex h-11 w-11 items-center justify-center rounded-md border border-border sm:hidden"
        >
          <span className="sr-only">Menú</span>
          {open ? (
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          )}
        </button>
      </div>

      {open && (
        <div className="border-t border-border px-4 py-3 sm:hidden">
          <nav className="flex flex-col gap-1">
            {links.map((l) => (
              <NavLinkItem
                key={l.href}
                href={l.href}
                label={l.label}
                active={pathname === l.href}
                onClick={() => setOpen(false)}
              />
            ))}
          </nav>
          {usuarioRole !== "CLIENTE" && (
            <BuscarForm className="mt-3 border-t border-border pt-3" />
          )}
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
            <div className="flex items-center gap-2">
              {usuarioRole !== "CLIENTE" && <NotificationBell />}
              <span className="text-sm text-muted">
                {usuarioNombre} · {usuarioRole}
              </span>
              <UbicacionChip ubicacion={usuarioUbicacion} />
            </div>
            <form action={logoutAction}>
              <button type="submit" className={buttonClass("secondary", "sm")}>
                Salir
              </button>
            </form>
          </div>
        </div>
      )}
    </header>
  );
}
