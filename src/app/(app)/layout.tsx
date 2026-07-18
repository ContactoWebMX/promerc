import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/dal";
import { logout } from "@/app/(auth)/login/actions";

export default async function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const usuario = await getCurrentUser();

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="flex items-center justify-between border-b border-black/10 px-6 py-4 dark:border-white/10">
        <div className="flex items-center gap-6">
          <span className="font-semibold">PROMERC</span>
          {usuario.role !== "CLIENTE" && (
            <>
              <Link href="/pesajes" className="text-sm underline">
                Pesajes
              </Link>
              <Link href="/compras" className="text-sm underline">
                Compras
              </Link>
              <Link href="/lotes" className="text-sm underline">
                Lotes
              </Link>
              <Link href="/ventas" className="text-sm underline">
                Ventas
              </Link>
              <Link href="/reportes" className="text-sm underline">
                Reportes
              </Link>
            </>
          )}
          {(usuario.role === "ADMIN" || usuario.role === "SUPERVISOR") && (
            <Link href="/catalogos" className="text-sm underline">
              Catálogos
            </Link>
          )}
        </div>
        <div className="flex items-center gap-4 text-sm">
          <span>
            {usuario.nombre} · {usuario.role}
          </span>
          <form action={logout}>
            <button type="submit" className="underline">
              Salir
            </button>
          </form>
        </div>
      </header>
      <main className="flex flex-1 flex-col p-6">{children}</main>
    </div>
  );
}
